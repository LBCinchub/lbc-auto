import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import {
  resolveAuth, fail, newCorrelationId,
  handleCreateBooking, handleCheckStatus, handleSendChatMessage,
  handleGetChatMessages, handleResumeSession,
  handleResolvePublicAlias, handleGetShopServices,
} from "../../shared/webBookingCore.ts";

export default async function (req) {
  const cid = newCorrelationId();
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = body.action || "create_booking";
    const entities = base44.asServiceRole.entities;

    const auth = await resolveAuth(entities, body);
    if (auth.blocked) return fail(auth.blocked.code, auth.blocked.cid, auth.blocked.status);

    let result;
    switch (action) {
      case "create_booking":
        result = await handleCreateBooking(entities, auth, body, cid);
        break;
      case "check_status":
        result = await handleCheckStatus(entities, auth, body, cid);
        break;
      case "send_chat_message":
        result = await handleSendChatMessage(entities, auth, body, cid);
        break;
      case "get_chat_messages":
        result = await handleGetChatMessages(entities, auth, body, cid);
        break;
      case "resume_session":
        result = await handleResumeSession(entities, auth, body, cid);
        break;
      case "resolve_public_alias":
        result = await handleResolvePublicAlias(entities, auth, cid);
        break;
      case "get_shop_services":
        result = await handleGetShopServices(entities, auth, cid);
        break;
      default:
        return fail("UNKNOWN_ACTION", cid, 400);
    }
    if (result.blocked) return fail(result.blocked.code, result.blocked.cid, result.blocked.status);
    return Response.json(result.response);
  } catch (error) {
    console.error("webBooking failure", { correlation_id: cid, message: error?.message });
    return fail("INTERNAL_ERROR", cid, 500);
  }
}