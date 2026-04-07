import { ContactRepository } from "./contact.repository.js";
import { ContactInput } from "./contact.schemas.js";
import { emailService } from "../../services/email/email.service.js";
import { logger } from "../../config/logger.js";

export class ContactService {
  constructor(private readonly repository: ContactRepository) {}

  async create(payload: ContactInput, userId?: string) {
    const message = await this.repository.createContactMessage({
      ...payload,
      userId,
    });

    try {
      const providerMessageId = await emailService.sendContactNotification({
        name: message.name,
        email: message.email,
        company: message.company ?? undefined,
        message: message.message,
        createdAt: message.createdAt,
      });

      logger.info(
        {
          contactMessageId: message.id,
          providerMessageId,
        },
        "Contact notification email sent",
      );
    } catch (error) {
      logger.error({ err: error, contactMessageId: message.id }, "Failed to send contact notification email");
    }

    return message;
  }
}
