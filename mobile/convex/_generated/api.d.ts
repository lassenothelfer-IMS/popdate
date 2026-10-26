/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as account from "../account.js";
import type * as auth from "../auth.js";
import type * as chat from "../chat.js";
import type * as http from "../http.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_game from "../lib/game.js";
import type * as lib_people from "../lib/people.js";
import type * as lib_profanity from "../lib/profanity.js";
import type * as lib_questions from "../lib/questions.js";
import type * as lib_rateLimit from "../lib/rateLimit.js";
import type * as lib_room from "../lib/room.js";
import type * as lib_uploads from "../lib/uploads.js";
import type * as matches from "../matches.js";
import type * as profiles from "../profiles.js";
import type * as queue from "../queue.js";
import type * as rooms from "../rooms.js";
import type * as safety from "../safety.js";
import type * as settings from "../settings.js";
import type * as testPlayers from "../testPlayers.js";
import type * as users from "../users.js";
import type * as verification from "../verification.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  account: typeof account;
  auth: typeof auth;
  chat: typeof chat;
  http: typeof http;
  "lib/auth": typeof lib_auth;
  "lib/errors": typeof lib_errors;
  "lib/game": typeof lib_game;
  "lib/people": typeof lib_people;
  "lib/profanity": typeof lib_profanity;
  "lib/questions": typeof lib_questions;
  "lib/rateLimit": typeof lib_rateLimit;
  "lib/room": typeof lib_room;
  "lib/uploads": typeof lib_uploads;
  matches: typeof matches;
  profiles: typeof profiles;
  queue: typeof queue;
  rooms: typeof rooms;
  safety: typeof safety;
  settings: typeof settings;
  testPlayers: typeof testPlayers;
  users: typeof users;
  verification: typeof verification;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
