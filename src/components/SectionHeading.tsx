import { motion } from "framer-motion";

interface SectionHeadingProps {
  badge?: string;
  title: string;
  subtitle?: string;
  center?: boolean;
}

const SectionHeading = ({ badge, title, subtitle, center = true }: SectionHeadingProps) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    className={`mb-12 ${center ? "text-center" : ""}`}
  >
    {badge && (
      <span className="inline-block px-3 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary border border-primary/20 mb-4">
        {badge}
      </span>
    )}
    <h2 className="text-3xl sm:text-4xl font-heading font-bold text-foreground">{title}</h2>
    {subtitle && (
      <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">{subtitle}</p>
    )}
  </motion.div>
);

export default SectionHeading;
