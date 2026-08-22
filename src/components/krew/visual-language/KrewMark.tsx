import type { SVGProps } from "react";
import { cn } from "@/lib/utils";

export type KrewMarkType =
  | "circle" | "circle-loose" | "underline" | "underline-wave" | "underline-double"
  | "arrow" | "arrow-right" | "arrow-left" | "arrow-up" | "arrow-down"
  | "arrow-up-right" | "arrow-up-left" | "arrow-down-right" | "arrow-down-left"
  | "arrow-curved-right" | "arrow-curved-left" | "arrow-curved-down" | "arrow-loop"
  | "sparkle" | "heart" | "check" | "connector" | "connector-curve" | "connector-dotted"
  | "highlight" | "bracket" | "corner" | "cross" | "plus" | "burst" | "scribble" | "tape"
  | "stamp-circle" | "route" | "pin-line";
export type KrewMarkTone = "plum" | "sage" | "ink";
export type KrewMarkSize = "sm" | "md" | "lg";
const TONES:Record<KrewMarkTone,string>={plum:"text-primary",sage:"text-sage",ink:"text-foreground"};
const SIZES:Record<KrewMarkSize,string>={sm:"h-5 w-10",md:"h-8 w-16",lg:"h-12 w-24"};
const STROKE={fill:"none",stroke:"currentColor",strokeWidth:2.25,strokeLinecap:"round",strokeLinejoin:"round",vectorEffect:"non-scaling-stroke"} satisfies SVGProps<SVGPathElement>;
const P=({d,dash}:{d:string;dash?:string})=><path {...STROKE} d={d} strokeDasharray={dash}/>;
function Arrow({flipX=false,flipY=false,diagonal=false}:{flipX?:boolean;flipY?:boolean;diagonal?:boolean}){return <g transform={`${flipX?"translate(100 0) scale(-1 1)":""} ${flipY?"translate(0 64) scale(1 -1)":""}`}><P d={diagonal?"M10 51c18-4 37-15 68-36":"M8 32c24-3 47-2 78 0"}/><P d={diagonal?"M68 10l13 4-4 13":"M76 23l12 9-12 9"}/></g>}
function MarkShape({type,dashed=false}:{type:KrewMarkType;dashed?:boolean}){switch(type){
case"circle":return <P d="M48 6C72 5 91 15 94 31c3 17-14 29-42 30C25 62 7 52 6 35 5 18 23 8 48 6Z"/>;
case"circle-loose":return <P d="M51 7C77 5 94 17 92 34 90 53 67 61 39 57 14 54 4 42 9 27 5 15 27 8 51 7Z"/>;
case"underline":return <P d="M5 39c21-3 42-1 61-3 12-1 21-4 29-2"/>; case"underline-wave":return <P d="M4 39c13-7 23 5 36-1s24-5 35-1c8 3 14 1 21-2"/>; case"underline-double":return <><P d="M5 34c24-2 46 1 90-4"/><P d="M9 43c28-3 53 1 82-3"/></>;
case"arrow":case"arrow-up-right":return <Arrow diagonal/>; case"arrow-right":return <Arrow/>; case"arrow-left":return <Arrow flipX/>; case"arrow-up-left":return <Arrow diagonal flipX/>; case"arrow-down-right":return <Arrow diagonal flipY/>; case"arrow-down-left":return <Arrow diagonal flipX flipY/>;
case"arrow-up":return <><P d="M50 58c-2-17 2-32-1-48"/><P d="M40 19 49 8l11 12"/></>; case"arrow-down":return <><P d="M49 6c2 17-2 32 1 48"/><P d="M40 45l10 11 10-12"/></>;
case"arrow-curved-right":return <><P d="M7 50c16-1 22-9 27-19C40 18 53 14 84 18"/><P d="M75 10l12 8-10 9"/></>; case"arrow-curved-left":return <g transform="translate(100 0) scale(-1 1)"><P d="M7 50c16-1 22-9 27-19C40 18 53 14 84 18"/><P d="M75 10l12 8-10 9"/></g>; case"arrow-curved-down":return <><P d="M18 8c0 18 8 24 20 29 11 5 17 10 17 20"/><P d="m45 48 10 10 9-11"/></>;
case"arrow-loop":return <><P d="M8 48c20 5 37 1 43-9 7-12-8-20-16-11-8 9 8 20 48 2"/><P d="M75 23l11 6-8 10"/></>;
case"sparkle":return <><P d="M49 9c-1 12-3 21-10 27 7 1 13 6 15 16 2-10 6-16 14-19-8-3-13-11-19-24Z"/><P d="M78 14l2 7 7 2-7 2-2 7-2-7-7-2 7-2 2-7Z"/></>; case"heart":return <P d="M50 54C39 45 19 35 18 21 17 10 31 6 39 13c5 4 8 10 10 15 3-7 7-13 13-17 9-5 21 1 20 12-1 13-18 24-32 31Z"/>; case"check":return <P d="M15 34c9 4 15 10 21 18 12-19 28-32 49-43"/>;
case"connector":return <P dash={dashed?"5 7":undefined} d="M5 44c17-26 35-31 51-18 13 11 23 10 39-8"/>; case"connector-curve":return <P d="M4 51c18-35 38 7 55-18C68 20 78 17 96 19"/>; case"connector-dotted":return <P dash="2 7" d="M4 45c21-29 41-22 54-9 11 11 22 8 38-12"/>;
case"highlight":return <path fill="currentColor" opacity="0.2" d="M4 22C25 17 48 19 69 16c12-2 21 0 27 4l-2 25c-22-2-44 2-65 1-10 0-18-2-25-5V22Z"/>; case"bracket":return <P d="M82 7c-13 0-17 7-17 15v5c0 5-4 8-10 9 6 1 10 4 10 9v4c0 8 4 11 17 11"/>; case"corner":return <P d="M12 52V16c0-5 3-8 8-8h42"/>; case"cross":return <><P d="M35 18l30 29"/><P d="M66 17L34 48"/></>; case"plus":return <><P d="M50 14v36"/><P d="M31 32h38"/></>; case"burst":return <P d="M50 4v13M50 48v12M18 32H5M95 32H81M27 10l8 11M73 10l-8 11M26 54l9-10M74 54l-9-10"/>; case"scribble":return <P d="M8 38c9-25 15 22 25-5 8-21 11 21 21 1 8-17 13 16 21 0 7-13 12 9 20-4"/>; case"tape":return <path fill="currentColor" opacity="0.16" d="M23 10l55 5-5 39-56-6 6-38Z"/>; case"stamp-circle":return <><P dash="4 4" d="M50 7c25 0 41 10 42 27 1 16-16 25-42 24C25 58 8 49 8 33 8 17 25 7 50 7Z"/><P d="M34 33l10 9 22-23"/></>; case"route":return <P dash="3 6" d="M5 51c15-33 31 4 44-22C61 5 75 18 95 9"/>; case"pin-line":return <><P d="M19 18c0-8 13-8 13 0 0 6-7 12-7 12s-6-7-6-12Z"/><P d="M26 31c12 4 20 8 31 9 14 2 23-3 39-13"/></>}}
export function KrewMark({type,tone="plum",size="md",rotation=0,decorative=true,dashed=false,className}:{type:KrewMarkType;tone?:KrewMarkTone;size?:KrewMarkSize;rotation?:-4|-2|0|2|4;decorative?:boolean;dashed?:boolean;className?:string}){return <svg viewBox="0 0 100 64" aria-hidden={decorative?true:undefined} role={decorative?undefined:"img"} className={cn("shrink-0 overflow-visible",TONES[tone],SIZES[size],className)} style={{transform:`rotate(${rotation}deg)`}}><MarkShape type={type} dashed={dashed}/></svg>}
