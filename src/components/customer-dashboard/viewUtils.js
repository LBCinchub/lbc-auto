export function timeAgo(value) {
  if (!value) return ""; const seconds = Math.max(0, (Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return "Just now"; if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
export const notificationDestination = (notification) => notification.type === "message" ? "messages" : notification.type === "offer" ? "offers" : notification.type === "review_request" ? "review" : "home";