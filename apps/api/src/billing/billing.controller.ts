import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Inject,
  Logger,
  Post,
  Req,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { AccessTokenGuard, type AuthenticatedRequest } from '../auth/http';
import { DatabaseService } from '../database/database.service';

@Controller('billing')
@UseGuards(AccessTokenGuard)
export class BillingController {
  private readonly logger = new Logger(BillingController.name);

  constructor(@Inject(DatabaseService) private readonly databaseService: DatabaseService) {}

  @Post('portal-session')
  @HttpCode(200)
  async createPortalSession(
    @Req() req: AuthenticatedRequest,
    @Body() body: { returnUrl?: string },
  ) {
    const userId = req.authPrincipal?.userId;
    if (!userId) {
      throw new BadRequestException('User authentication required');
    }

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey || stripeKey.trim() === '') {
      throw new ServiceUnavailableException(
        'Stripe billing is not configured. STRIPE_SECRET_KEY environment variable is required to create a billing portal session.',
      );
    }

    const cols = this.databaseService.collections;
    if (!cols) {
      throw new ServiceUnavailableException('Database unavailable');
    }

    const user = await cols.users.findOne({ id: userId } as any);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    let customerId = (user as any).stripeCustomerId;

    // Create customer in Stripe if not already existing
    if (!customerId) {
      try {
        const createCustParams = new URLSearchParams({
          email: user.email,
          name: user.displayName || user.email,
          'metadata[userId]': userId,
        });

        const custRes = await fetch('https://api.stripe.com/v1/customers', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${stripeKey}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: createCustParams.toString(),
        });

        const custData = (await custRes.json()) as any;
        if (!custRes.ok || !custData.id) {
          this.logger.error(`Failed to create Stripe customer: ${JSON.stringify(custData)}`);
          throw new BadRequestException(custData.error?.message || 'Failed to initialize Stripe customer');
        }

        customerId = custData.id;
        await cols.users.updateOne(
          { id: userId } as any,
          { $set: { stripeCustomerId: customerId, updatedAt: new Date() } },
        );
      } catch (err: any) {
        if (err instanceof BadRequestException) throw err;
        throw new ServiceUnavailableException(`Stripe API connection failed: ${err.message}`);
      }
    }

    // Create billing portal session
    const returnUrl = body?.returnUrl || 'http://localhost:5173/overview';
    try {
      const portalParams = new URLSearchParams({
        customer: customerId,
        return_url: returnUrl,
      });

      const portalRes = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${stripeKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: portalParams.toString(),
      });

      const portalData = (await portalRes.json()) as any;
      if (!portalRes.ok || !portalData.url) {
        this.logger.error(`Failed to create Stripe portal session: ${JSON.stringify(portalData)}`);
        throw new BadRequestException(
          portalData.error?.message || 'Could not generate Stripe billing portal session',
        );
      }

      return {
        url: portalData.url,
        customerId,
      };
    } catch (err: any) {
      if (err instanceof BadRequestException || err instanceof ServiceUnavailableException) throw err;
      throw new ServiceUnavailableException(`Stripe portal session failed: ${err.message}`);
    }
  }
}
