# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v55.0.0/ before writing any code.

# UI conventions

- **Keyboard must never hide an input.** Any screen with a `TextInput` must wrap its content in `KeyboardAvoidingView` **imported from `react-native-keyboard-controller`** (NOT from `react-native`), with `behavior="padding"` and `style={{ flex: 1 }}`, and put inputs inside a `ScrollView` with `keyboardShouldPersistTaps="handled"`. Apply this to every new/edited screen that has a text field — don't wait to be asked.
  - **Why the library, not RN's built-in:** this app is **edge-to-edge** (Expo SDK 55 default on Android), where RN's built-in `KeyboardAvoidingView` is unreliable — `behavior={undefined}` leaves bottom inputs hidden behind the keyboard, and `'height'`/`'padding'` leave a residual offset after the keyboard dismisses. `react-native-keyboard-controller`'s `KeyboardAvoidingView` tracks the keyboard frame natively and returns to the exact original position with no residual. The root is wrapped in its `<KeyboardProvider>` (`src/app/_layout.tsx`). It's a native module → adding/removing it needs a rebuild.
