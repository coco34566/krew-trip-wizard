// Keep the historical trips.functions API stable while overriding only the two
// group_logistics mutations that need row-level atomicity.
export * from "./trips.functions";
export {
  voteHotelAtomic as voteHotel,
  pickTransportAtomic as pickTransport,
} from "./trips-logistics-atomic.functions";
