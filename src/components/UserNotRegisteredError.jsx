import React from 'react';

const UserNotRegisteredError = () => {
  return (
    <div style={{ minHeight:"100vh", background:"#020617", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ maxWidth:400, width:"100%", background:"#0f172a", border:"1px solid #1e293b", borderRadius:20, padding:32, textAlign:"center" }}>
        <div style={{ width:64, height:64, borderRadius:"50%", background:"rgba(255,100,100,0.1)", border:"2px solid rgba(255,100,100,0.3)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 20px", fontSize:28 }}>
          🔒
        </div>
        <h1 style={{ color:"#fff", fontSize:22, fontWeight:800, margin:"0 0 12px" }}>Access Restricted</h1>
        <p style={{ color:"#64748b", fontSize:14, lineHeight:1.6, margin:"0 0 24px" }}>
          Your account is not registered on LBC Auto. Contact your shop owner to get access.
        </p>
        <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, padding:"14px 16px", textAlign:"left" }}>
          <p style={{ color:"#475569", fontSize:13, margin:"0 0 8px", fontWeight:600 }}>Try these steps:</p>
          <ul style={{ color:"#475569", fontSize:13, lineHeight:1.8, paddingLeft:18, margin:0 }}>
            <li>Make sure you're signed in with the right email</li>
            <li>Ask your shop owner to add your account</li>
            <li>Sign out and sign back in</li>
          </ul>
        </div>
        <p style={{ color:"#1e3a5f", fontSize:11, marginTop:24 }}>LBC Auto · lbc.network</p>
      </div>
    </div>
  );
};

export default UserNotRegisteredError;
