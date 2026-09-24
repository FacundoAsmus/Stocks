declare module "web-push" {
  type Subscription = { endpoint: string; keys: { p256dh: string; auth: string } };
  const webpush: {
    setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
    generateVAPIDKeys(): { publicKey: string; privateKey: string };
    sendNotification(subscription: Subscription, payload: string): Promise<unknown>;
  };
  export default webpush;
}
