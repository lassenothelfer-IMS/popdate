# Maestro flows

End-to-end flows for [Maestro](https://maestro.dev), run against the app in Expo Go on the
mock server (the default, with bot players).

## solo-playtest.yaml

Welcome, "Skip with a test profile", one room as the chooser (pick, wait, hold the coral Pop
button, keep the last one), one room as a balloon (answer), report and block someone through
the "..." menu, then Settings > Delete account.

To run it:

1. Start an iOS Simulator or Android emulator with Expo Go installed.
2. From `mobile/`, start Metro for Expo Go: `npm start` (it runs `expo start --go`).
   Leave `EXPO_PUBLIC_API` unset so the app uses the mock server.
3. In another terminal, from `mobile/`:

   ```sh
   maestro test .maestro/solo-playtest.yaml
   ```

   On an Android emulator, the host is `10.0.2.2`:

   ```sh
   maestro test -e DEV_URL=exp://10.0.2.2:8081 .maestro/solo-playtest.yaml
   ```

Notes:

- The flow needs a development build (`__DEV__`): the test-profile button and the
  Popper/Balloon chips only show there.
- The device language must be English; the flow taps the English labels.
- Bots answer and pop on random timers, so the waits are generous. A full run takes a few
  minutes.
