import React from "react";
import DemoFrame from "./DemoFrame";

export default function CapabilityDemo({ category }) {
  return <DemoFrame title={`${category.label} overview`} compact><div className="lp-cap-metrics">{category.demo.map(([label,value])=><span key={label}><small>{label}</small><strong>{value}</strong></span>)}</div><div className="lp-cap-lines"><span/><span/><span/><i>CONNECTED SAMPLE WORKSPACE</i></div></DemoFrame>;
}