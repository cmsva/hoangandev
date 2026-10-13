import { createTRPCRouter } from "../init"
import { authRouter } from "./auth.router"
import { dashboardRouter } from "./dashboard.router"
import { productRouter } from "./product.router"
import { orderRouter } from "./order.router"
import { domainRouter } from "./domain.router"
import { cronjobRouter } from "./cronjob.router"
import { logoRouter } from "./logo.router"
import { serviceRouter } from "./service.router"
import { profileRouter } from "./profile.router"
import { profileLinkRouter } from "./profile-link.router"
import { depositRouter } from "./deposit.router"
import { cardRouter } from "./card.router"
import { affiliateRouter } from "./affiliate.router"
import { ticketRouter } from "./ticket.router"
import { postRouter } from "./post.router"
import { publicRouter } from "./public.router"
import { adminRouter } from "./admin.router"
import { adminProductRouter } from "./admin-product.router"
import { adminPostRouter } from "./admin-post.router"
import { adminDomainRouter } from "./admin-domain.router"
import { adminCronjobRouter } from "./admin-cronjob.router"
import { adminLogoRouter } from "./admin-logo.router"
import { adminUserRouter } from "./admin-user.router"
import { adminDepositRouter } from "./admin-deposit.router"
import { adminAffiliateRouter } from "./admin-affiliate.router"
import { adminCouponRouter } from "./admin-coupon.router"
import { adminTicketRouter } from "./admin-ticket.router"
import { adminWebsiteRouter } from "./admin-website.router"
import { adminIpBlockRouter } from "./admin-ip-block.router"
import { adminExtensionsRouter } from "./admin-extensions.router"
import { adminStaticPageRouter } from "./admin-static-page.router"
import { adminSeoRouter } from "./admin-seo.router"
import { apiKeyRouter } from "./api-key.router"
import { rewardsRouter } from "./rewards.router"
import { adminRewardsRouter } from "./admin-rewards.router"
import { adminCampaignRouter } from "./admin-campaign.router"
import { notificationRouter } from "./notification.router"
import { adminNotificationRouter } from "./admin-notification.router"
import { adminRedisRouter } from "./admin-redis.router"
import { aiRouter, adminAiRouter } from "./ai.router"
import { setupRouter } from "./setup.router"
import { passkeyRouter } from "./passkey.router"

export const appRouter = createTRPCRouter({
  auth: authRouter,
  dashboard: dashboardRouter,
  product: productRouter,
  order: orderRouter,
  domain: domainRouter,
  cronjob: cronjobRouter,
  logo: logoRouter,
  service: serviceRouter,
  profile: profileRouter,
  profileLink: profileLinkRouter,
  deposit: depositRouter,
  card: cardRouter,
  affiliate: affiliateRouter,
  ticket: ticketRouter,
  post: postRouter,
  public: publicRouter,
  apiKey: apiKeyRouter,
  passkey: passkeyRouter,
  rewards: rewardsRouter,
  notification: notificationRouter,
  admin: adminRouter,
  adminProduct: adminProductRouter,
  adminPost: adminPostRouter,
  adminDomain: adminDomainRouter,
  adminCronjob: adminCronjobRouter,
  adminLogo: adminLogoRouter,
  adminUser: adminUserRouter,
  adminDeposit: adminDepositRouter,
  adminAffiliate: adminAffiliateRouter,
  adminCoupon: adminCouponRouter,
  adminTicket: adminTicketRouter,
  adminWebsite: adminWebsiteRouter,
  adminIpBlock: adminIpBlockRouter,
  adminExtensions: adminExtensionsRouter,
  adminStaticPage: adminStaticPageRouter,
  adminSeo: adminSeoRouter,
  adminRewards: adminRewardsRouter,
  adminCampaign: adminCampaignRouter,
  adminNotification: adminNotificationRouter,
  adminRedis: adminRedisRouter,
  ai: aiRouter,
  adminAi: adminAiRouter,
  setup: setupRouter,
})

export type AppRouter = typeof appRouter
