import type { SVGProps } from "react";
import { cn } from "@/lib/utils";

export type KrewIconName = "invite"|"availability"|"preferences"|"profile"|"destination"|"accommodation"|"transport"|"planning"|"tasks"|"packing"|"budget"|"calendar"|"group"|"map"|"camera"|"food"|"drink"|"plane"|"train"|"walk"|"boat"|"nature"|"beach"|"party"|"time"|"vote"|"favorite"|"booked"|"attention"|"check"|"message"|"search"|"plus";
export type KrewIconTone="plum"|"sage"|"ink"|"muted"; export type KrewIconSize="sm"|"md"|"lg";
const TONES:Record<KrewIconTone,string>={plum:"text-primary",sage:"text-sage",ink:"text-foreground",muted:"text-muted-foreground"};
const SIZES:Record<KrewIconSize,string>={sm:"size-5",md:"size-7",lg:"size-10"};
const S={fill:"none",stroke:"currentColor",strokeWidth:2.05,strokeLinecap:"round",strokeLinejoin:"round",vectorEffect:"non-scaling-stroke"} satisfies SVGProps<SVGPathElement>;
const L={...S,strokeWidth:1.6,opacity:.72} satisfies SVGProps<SVGPathElement>;
const P=({d,soft=false}:{d:string;soft?:boolean})=><path {...(soft?L:S)} d={d}/>; const D=({cx,cy,r=1.25}:{cx:number;cy:number;r?:number})=><circle cx={cx} cy={cy} r={r} fill="currentColor"/>;
function Shape({n}:{n:KrewIconName}){switch(n){
case"invite":return <><P d="M9.4 12.2c2.2 0 3.8-1.7 3.8-3.9 0-2.1-1.6-3.7-3.8-3.7S5.7 6.2 5.7 8.3c0 2.2 1.5 3.9 3.7 3.9Z"/><P d="M3.3 21.3c.4-4 2.5-6.1 6.2-6.1 2.4 0 4.2.9 5.3 2.6M18.9 9.3v8.1M14.8 13.4h8.1"/></>;
case"availability":case"calendar":return <><P d="M4.2 8.3c4.6-.3 10.6-.3 15.6 0l-.4 12.1c-4.7.4-10 .4-14.8 0L4.2 8.3Z"/><P d="M8.1 5v5M15.9 4.7v5.1"/><P soft d="M4.5 11.6c4.4-.2 10.5-.2 15.1 0"/><P d="m8.2 15.7 2.2 2.1 5.6-5.5"/></>;
case"preferences":return <><P d="M4.1 7.2h15.8M4.1 12.3h15.8M4.1 17.5h15.8"/><D cx={8.8} cy={7.2} r={1.65}/><D cx={15.4} cy={12.3} r={1.65}/><D cx={10.8} cy={17.5} r={1.65}/></>;
case"profile":return <><P d="M4.6 9c2.1-2.6 4.6-3.9 7.5-3.9 3 0 5.5 1.3 7.5 3.9M5.4 16.1c1.9 2.5 4.1 3.8 6.7 3.8 2.5 0 4.8-1.3 6.6-3.8"/><P soft d="M7.8 11.2c1.2 1.6 2.7 2.4 4.4 2.4 1.6 0 3-.7 4.1-2.1"/><D cx={12.1} cy={13.5}/></>;
case"destination":return <><P d="M12.1 21.1C8.3 17 6.1 13.7 6.1 10.7c0-3.6 2.5-6.1 6-6.1 3.6 0 5.9 2.5 5.9 6.1 0 2.9-2.1 6.2-5.9 10.4Z"/><P d="M8.9 11c1.1-1.4 2.2-2 3.6-1.9 1.2.1 2.1.6 2.9 1.6"/><D cx={15.9} cy={7.1} r={1}/></>;
case"accommodation":return <><P d="M3.8 13 12 5.7 20.2 13M6.2 11.2v9h11.6v-9"/><P d="M9.2 20.2v-5.6c1.8-.4 3.7-.4 5.6 0v5.6"/><P soft d="M8 9.3c2.7-.7 5.4-.7 8 0"/></>;
case"transport":return <><P d="M3.5 15.6c4.8-1.1 9.5-3.7 16.9-9.6l.5 2.5-6.4 6.2 3.2 2.2-1.5 1.4-4.5-1.2-3.4 3.2-1.4-.8 1.6-4.2-5 .3Z"/><P soft d="M11.1 12.7 8.4 9.2"/></>;
case"planning":return <><P d="M5 6.8c4.2-.3 9.6-.3 14 0l-.3 14c-4.2.3-9.1.3-13.4 0L5 6.8Z"/><P d="M8.6 4.4v4.7M15.4 4.4v4.7"/><P soft d="M9.1 11.4h6.3M9.1 15h4.8M9.1 18.4h6.1"/></>;
case"tasks":return <><P d="m4.1 7 1.8 1.9 3.2-3.5M4.1 13l1.8 1.9 3.2-3.5M4.1 19l1.8 1.9 3.2-3.5"/><P soft d="M11.4 7.1h8.4M11.4 13.1h6.2M11.4 19.1h8.4"/></>;
case"packing":return <><P d="M6.1 8.4c3.4-.5 8.1-.5 11.6 0l1 12.1c-3.9.5-9.5.5-13.4 0l.8-12.1Z"/><P d="M8.8 8.2V6.6c0-1.8 1.2-3 3.3-3 2 0 3.2 1.2 3.2 3v1.6"/><P soft d="M8.8 13.1c.9.9 2 1.4 3.3 1.4 1.3 0 2.4-.5 3.2-1.4"/></>;
case"budget":return <><P d="M4.4 8.1c4.5-1.1 10.3-1.1 15 0l-1.1 10.8c-4.1.8-8.8.8-12.9 0L4.4 8.1Z"/><P d="M13.5 10.8c-3.8 0-4.4 5.1-.4 5.4M8.4 12.1h5.7M8.4 14.8h5"/></>;
case"group":return <><circle {...S} cx="9" cy="8" r="3"/><circle {...L} cx="16.5" cy="9" r="2.3"/><P d="M3.5 20c.5-4.2 2.4-6.2 5.7-6.2s5.2 2 5.7 6.2"/><P soft d="M14 14.6c3.8-.8 6.1 1 6.6 4.5"/></>;
case"map":return <><P d="m4 6 5-2 6 2 5-2v14l-5 2-6-2-5 2V6Z"/><P soft d="M9 4v14M15 6v14"/></>;
case"camera":return <><P d="M4 8h4l1.5-2h5L16 8h4v11H4V8Z"/><circle {...S} cx="12" cy="13.5" r="3.2"/></>;
case"food":return <><P d="M7 4v7M4.5 4v5c0 2 1 3 2.5 3s2.5-1 2.5-3V4M7 12v8M16 4c-3 2-3 7 0 8v8M16 4v8"/></>;
case"drink":return <><P d="M7 4h10l-1.2 7c-.4 2-1.8 3-3.8 3s-3.4-1-3.8-3L7 4ZM12 14v6M8.5 20h7"/><P soft d="M8.2 8h7.6"/></>;
case"plane":return <><P d="M3 14l8-3 2-7 2 .5-.5 6 5-1.5 2 1.5-7 4-.5 5-1.5.5-1.5-4.5-5 1L3 14Z"/></>;
case"train":return <><P d="M6 5c3.5-1 8.5-1 12 0v11c0 2-1 3-3 3H9c-2 0-3-1-3-3V5Z"/><P soft d="M7 12h10M9 7h6"/><D cx={9} cy={15}/><D cx={15} cy={15}/></>;
case"walk":return <><circle {...S} cx="13" cy="5" r="2"/><P d="M11.5 8.5 9 13l3 2 2 5M10 13l-3 6M12 10l4 3 3-1"/></>;
case"boat":return <><P d="M4 14h16l-3 5H7l-3-5ZM8 14V7h7l2 7M8 7l4-3 3 3"/><P soft d="M3 21c3-1 5-1 8 0 3 1 6 1 10 0"/></>;
case"nature":return <><P d="M12 20V9M12 14c-4 0-7-2-7-6 4 0 7 2 7 6ZM12 11c4 0 7-2 7-6-4 0-7 2-7 6Z"/></>;
case"beach":return <><P d="M12 20V9M5 9c2-5 11-6 15-1-3-1-6 0-8 2-2-2-4-2-7-1ZM7 20h11"/></>;
case"party":return <><P d="m6 19 3-10 7 7-10 3ZM14 5l1-2M18 8l3-1M17 12l3 2"/><D cx={10} cy={6}/></>;
case"time":return <><circle {...S} cx="12" cy="12" r="8"/><P d="M12 7v5l3.5 2"/></>;
case"vote":return <><P d="M5 10h14l1 10H4l1-10ZM8 10l4-6 4 6M9 15h6"/></>;
case"favorite":return <P d="M12 20C8 17 4 14 4 9c0-4 5-5 8-1 3-4 8-3 8 1 0 5-4 8-8 11Z"/>;
case"booked":case"check":return <P d="M4 12l5 5L20 6"/>;
case"attention":return <><P d="M12 4 21 20H3L12 4Z"/><P d="M12 9v5"/><D cx={12} cy={17}/></>;
case"message":return <><P d="M4 5h16v12H9l-5 3V5Z"/><P soft d="M8 9h8M8 13h5"/></>;
case"search":return <><circle {...S} cx="10.5" cy="10.5" r="6"/><P d="m15 15 5 5"/></>;
case"plus":return <P d="M12 5v14M5 12h14"/>;
}}
export function KrewIcon({name,tone="plum",size="md",decorative=true,className}:{name:KrewIconName;tone?:KrewIconTone;size?:KrewIconSize;decorative?:boolean;className?:string}){return <svg viewBox="0 0 24 24" aria-hidden={decorative?true:undefined} role={decorative?undefined:"img"} className={cn("shrink-0 overflow-visible",TONES[tone],SIZES[size],className)}><Shape n={name}/></svg>}
