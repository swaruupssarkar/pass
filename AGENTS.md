# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v55.0.0/ before writing any code.

# UI conventions

- **Keyboard must never hide an input.** Any screen with a `TextInput` must wrap its content in `KeyboardAvoidingView` (`behavior={Platform.OS === 'ios' ? 'padding' : 'height'}`, `style={{ flex: 1 }}`), and put inputs inside a `ScrollView` with `keyboardShouldPersistTaps="handled"` so the focused field scrolls above the keyboard. Apply this to every new/edited screen that has a text field — don't wait to be asked.
