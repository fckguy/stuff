// Number of seconds in a day
pub const SECONDS_PER_DAY: i64 = 60 * 60 * 24;

// Maximum timelock delay.
pub const MAX_DELAY_SECONDS: i64 = 365 * SECONDS_PER_DAY;

// Default number of seconds until a transaction expires.
pub const DEFAULT_GRACE_PERIOD: i64 = 14 * SECONDS_PER_DAY;

// Constant declaring that there is no ETA of the transaction
pub const NO_ETA: i64 = -1;

// Anchor discriminator for set_frozen instruction
pub const SET_FROZEN_DISCRIMINATOR: [u8; 8] = [62, 87, 99, 96, 206, 47, 204, 18];
