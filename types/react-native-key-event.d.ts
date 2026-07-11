declare module 'react-native-key-event' {
  interface KeyEventSubscription {
    remove(): void;
  }

  interface KeyEventStatic {
    onKeyDownListener(callback: (keyCode: number) => boolean): KeyEventSubscription;
    onKeyUpListener(callback: (keyCode: number) => boolean): KeyEventSubscription;
  }

  const KeyEvent: KeyEventStatic;
  export default KeyEvent;
}
