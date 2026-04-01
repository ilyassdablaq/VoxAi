import { PrismaClient } from "@prisma/client";
import { logger } from "../../config/logger.js";

export interface GoldenTestCase {
  id?: string;
  name: string;
  inputText: string;
  expectedOutput: string;
  version?: number;
  metadata?: Record<string, any>;
}

export interface EvaluationResult {
  testId: string;
  modelName: string;
  promptVersion: number;
  actualOutput: string;
  similarityScore: number; // 0-1
  qualityScore: number; // 0-1
  latencyMs: number;
  tokensUsed: number;
  status: "passed" | "failed" | "degraded";
  releaseGateDecision: "approved" | "blocked" | "manual_review";
}

export interface ReleaseGateConfig {
  minSimilarityScore: number;
  minQualityScore: number;
  maxLatencyMs: number;
  tokenEfficiencyTarget: number;
}

export class RegressionSuiteService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create or update a golden test case
   */
  async createGoldenTest(
    test: GoldenTestCase,
    createdBy?: string,
  ): Promise<GoldenTestCase> {
    try {
      const created = await this.prisma.goldenTestSet.create({
        data: {
          name: test.name,
          inputText: test.inputText,
          expectedOutput: test.expectedOutput,
          version: test.version || 1,
          metadata: test.metadata,
          createdBy,
        },
      });

      logger.info("Golden test created", { testId: created.id, name: test.name });

      return {
        id: created.id,
        name: created.name,
        inputText: created.inputText,
        expectedOutput: created.expectedOutput,
        version: created.version,
        metadata: created.metadata as any,
      };
    } catch (error) {
      logger.error("Failed to create golden test", { error, testName: test.name });
      throw error;
    }
  }

  /**
   * Run offline evaluation on a golden test set
   */
  async runOfflineEvaluation(
    goldenTestId: string,
    modelName: string,
    promptVersion: number,
    actualOutput: string,
    chunkingStrategy?: string,
  ): Promise<EvaluationResult> {
    try {
      const goldenTest = await this.prisma.goldenTestSet.findUnique({
        where: { id: goldenTestId },
      });

      if (!goldenTest) {
        throw new Error(`Golden test ${goldenTestId} not found`);
      }

      // Calculate scores
      const similarityScore = this.calculateSimilarity(actualOutput, goldenTest.expectedOutput);
      const qualityScore = this.evaluateQuality(actualOutput, goldenTest.expectedOutput);
      const latencyMs = Math.floor(Math.random() * 2000); // Placeholder
      const tokensUsed = Math.floor(actualOutput.split(" ").length * 1.3); // Rough estimate

      // Evaluate against release gates
      const gateConfig = await this.getReleaseGateConfig();
      const releaseGateDecision = this.evaluateReleaseGate(
        {
          testId: goldenTestId,
          modelName,
          promptVersion,
          actualOutput,
          similarityScore,
          qualityScore,
          latencyMs,
          tokensUsed,
          status: similarityScore >= gateConfig.minSimilarityScore ? "passed" : "failed",
          releaseGateDecision: "approved",
        },
        gateConfig,
      ).releaseGateDecision;

      const status =
        releaseGateDecision === "approved"
          ? similarityScore >= 0.9
            ? "passed"
            : "degraded"
          : "failed";

      // Store evaluation result
      await this.prisma.offlineEvaluation.create({
        data: {
          goldenTestSetId: goldenTestId,
          modelName,
          promptVersion,
          chunkingStrategy,
          actualOutput,
          similarityScore,
          qualityScore,
          latencyMs,
          tokensUsed,
          evaluationStatus: status,
          releaseGateResult: releaseGateDecision,
          evaluatedAt: new Date(),
        },
      });

      logger.info("Offline evaluation completed", {
        testId: goldenTestId,
        modelName,
        status,
        similarityScore: Math.round(similarityScore * 100) / 100,
      });

      return {
        testId: goldenTestId,
        modelName,
        promptVersion,
        actualOutput,
        similarityScore,
        qualityScore,
        latencyMs,
        tokensUsed,
        status,
        releaseGateDecision,
      };
    } catch (error) {
      logger.error("Failed to run offline evaluation", { error, goldenTestId });
      throw error;
    }
  }

  /**
   * Batch evaluate against entire golden test set
   */
  async runBatchEvaluation(
    modelName: string,
    promptVersion: number,
    evaluationFn: (inputText: string) => Promise<string>,
  ): Promise<{
    passed: number;
    failed: number;
    degraded: number;
    averageSimilarity: number;
    releaseGateApproved: boolean;
  }> {
    try {
      const goldenTests = await this.prisma.goldenTestSet.findMany();

      let passed = 0;
      let failed = 0;
      let degraded = 0;
      let totalSimilarity = 0;

      for (const test of goldenTests) {
        try {
          const actualOutput = await evaluationFn(test.inputText);
          const result = await this.runOfflineEvaluation(
            test.id,
            modelName,
            promptVersion,
            actualOutput,
          );

          totalSimilarity += result.similarityScore;

          if (result.status === "passed") passed++;
          else if (result.status === "degraded") degraded++;
          else failed++;
        } catch (error) {
          logger.error("Error evaluating single test", { error, testId: test.id });
          failed++;
        }
      }

      const totalTests = goldenTests.length || 1;
      const averageSimilarity = totalSimilarity / totalTests;
      const releaseGateApproved = failed === 0 && averageSimilarity >= 0.85;

      logger.info("Batch evaluation completed", {
        modelName,
        promptVersion,
        passed,
        failed,
        degraded,
        averageSimilarity: Math.round(averageSimilarity * 100) / 100,
        releaseGateApproved,
      });

      return {
        passed,
        failed,
        degraded,
        averageSimilarity,
        releaseGateApproved,
      };
    } catch (error) {
      logger.error("Failed to run batch evaluation", { error });
      throw error;
    }
  }

  /**
   * Get release gate configuration
   */
  async getReleaseGateConfig(): Promise<ReleaseGateConfig> {
    try {
      const gate = await this.prisma.releaseGate.findUnique({
        where: { gateName: "default" },
      });

      if (gate) {
        return {
          minSimilarityScore: gate.minSimilarityScore,
          minQualityScore: gate.minQualityScore,
          maxLatencyMs: gate.maxLatencyMs,
          tokenEfficiencyTarget: gate.tokenEfficiencyTarget,
        };
      }

      // Return defaults
      return {
        minSimilarityScore: 0.85,
        minQualityScore: 0.8,
        maxLatencyMs: 3000,
        tokenEfficiencyTarget: 0.95,
      };
    } catch (error) {
      logger.error("Failed to get release gate config", { error });
      return {
        minSimilarityScore: 0.85,
        minQualityScore: 0.8,
        maxLatencyMs: 3000,
        tokenEfficiencyTarget: 0.95,
      };
    }
  }

  /**
   * Update release gate thresholds
   */
  async updateReleaseGate(
    config: ReleaseGateConfig,
    overrideReason?: string,
    overrideAdminId?: string,
  ): Promise<void> {
    try {
      await this.prisma.releaseGate.upsert({
        where: { gateName: "default" },
        update: {
          minSimilarityScore: config.minSimilarityScore,
          minQualityScore: config.minQualityScore,
          maxLatencyMs: config.maxLatencyMs,
          tokenEfficiencyTarget: config.tokenEfficiencyTarget,
          overrideReason,
          overrideAdminId,
          overrideUntil: overrideAdminId ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : null,
        },
        create: {
          gateName: "default",
          minSimilarityScore: config.minSimilarityScore,
          minQualityScore: config.minQualityScore,
          maxLatencyMs: config.maxLatencyMs,
          tokenEfficiencyTarget: config.tokenEfficiencyTarget,
          overrideReason,
          overrideAdminId,
        },
      });

      logger.info("Release gate updated", { config });
    } catch (error) {
      logger.error("Failed to update release gate", { error });
      throw error;
    }
  }

  /**
   * Get evaluation history
   */
  async getEvaluationHistory(
    modelName: string,
    limit = 50,
  ): Promise<
    Array<{
      id: string;
      modelName: string;
      promptVersion: number;
      similarityScore: number;
      qualityScore: number;
      status: string;
      evaluatedAt: Date;
    }>
  > {
    try {
      const evaluations = await this.prisma.offlineEvaluation.findMany({
        where: { modelName },
        orderBy: { evaluatedAt: "desc" },
        take: limit,
        select: {
          id: true,
          modelName: true,
          promptVersion: true,
          similarityScore: true,
          qualityScore: true,
          evaluationStatus: true,
          evaluatedAt: true,
        },
      });

      return evaluations.map((e) => ({
        id: e.id,
        modelName: e.modelName,
        promptVersion: e.promptVersion,
        similarityScore: e.similarityScore,
        qualityScore: e.qualityScore,
        status: e.evaluationStatus,
        evaluatedAt: e.evaluatedAt,
      }));
    } catch (error) {
      logger.error("Failed to get evaluation history", { error, modelName });
      return [];
    }
  }

  /**
   * Check if model/prompt combination is approved for release
   */
  async isReleaseApproved(modelName: string, promptVersion: number): Promise<boolean> {
    try {
      const gate = await this.getReleaseGateConfig();

      const recentEvaluations = await this.prisma.offlineEvaluation.findMany({
        where: {
          modelName,
          promptVersion,
          evaluatedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      });

      if (recentEvaluations.length === 0) {
        return false;
      }

      const avgSimilarity = recentEvaluations.reduce((sum, e) => sum + e.similarityScore, 0) / recentEvaluations.length;
      const avgQuality = recentEvaluations.reduce((sum, e) => sum + e.qualityScore, 0) / recentEvaluations.length;

      return avgSimilarity >= gate.minSimilarityScore && avgQuality >= gate.minQualityScore;
    } catch (error) {
      logger.error("Failed to check release approval", { error });
      return false;
    }
  }

  private calculateSimilarity(actual: string, expected: string): number {
    // Simplified Jaccard similarity
    const actualWords = new Set(actual.toLowerCase().split(/\s+/));
    const expectedWords = new Set(expected.toLowerCase().split(/\s+/));

    const intersection = new Set([...actualWords].filter((x) => expectedWords.has(x)));
    const union = new Set([...actualWords, ...expectedWords]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private evaluateQuality(actual: string, expected: string): number {
    // Simple heuristics: length, completeness, grammatical structure
    const actualLen = actual.length;
    const expectedLen = expected.length;
    const lengthScore = Math.min(1, actualLen / Math.max(expectedLen, 1)) * 0.7;

    // Check for keyword presence from expected output
    const expectedKeywords = expected.split(/\s+/).filter((w) => w.length > 4);
    const presentKeywords = expectedKeywords.filter((k) => actual.toLowerCase().includes(k.toLowerCase()));
    const keywordScore = (presentKeywords.length / Math.max(expectedKeywords.length, 1)) * 0.3;

    return Math.min(1, lengthScore + keywordScore);
  }

  private evaluateReleaseGate(evaluation: EvaluationResult, config: ReleaseGateConfig): EvaluationResult {
    let decision: "approved" | "blocked" | "manual_review" = "approved";

    if (
      evaluation.similarityScore < config.minSimilarityScore ||
      evaluation.qualityScore < config.minQualityScore ||
      evaluation.latencyMs > config.maxLatencyMs
    ) {
      decision = "blocked";
    } else if (evaluation.similarityScore < config.minSimilarityScore * 1.05) {
      decision = "manual_review"; // Borderline
    }

    return {
      ...evaluation,
      releaseGateDecision: decision,
    };
  }
}

export const createRegressionSuiteService = (prisma: PrismaClient) => new RegressionSuiteService(prisma);
