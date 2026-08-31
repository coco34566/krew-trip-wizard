// Keep the historical trips.functions API stable while overriding only the
// mutations that need stricter atomicity or lifecycle permissions.
export * from "./trips.functions";
export {
  voteHotelAtomic as voteHotel,
  pickTransportAtomic as pickTransport,
} from "./trips-logistics-atomic.functions";
export { cancelTripOwnerOnly as cancelTrip } from "./trip-cancel-owner.functions";
