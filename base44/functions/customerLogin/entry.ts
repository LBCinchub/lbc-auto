export default async function() {
  return Response.json({ error: "This portal login has been retired. Use secureCustomerLogin." }, { status: 410 });
}