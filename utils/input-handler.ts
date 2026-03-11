/**
 * Input Handler - 輸入處理器
 * 負責鍵盤和觸控輸入監聽，並根據控制分配過濾輸入
 */

import type { InputState, InputEvent, ControlType } from '../types/game';

export class InputHandler {
  private inputState: InputState;
  private sequenceNumber: number = 0;
  private allowedControls: Set<ControlType>;
  private keyboardListeners: Map<string, (e: KeyboardEvent) => void> = new Map();
  private touchListeners: Map<string, (e: TouchEvent | MouseEvent) => void> = new Map();

  constructor(allowedControls: ControlType[]) {
    this.allowedControls = new Set(allowedControls);
    this.inputState = {
      accelerate: false,
      brake: false,
      turnLeft: false,
      turnRight: false,
      sequenceNumber: 0
    };
  }

  /**
   * 註冊輸入監聽器
   */
  registerInputListeners(): void {
    // 鍵盤監聽
    this.registerKeyboardListeners();
  }

  /**
   * 註冊鍵盤監聽器
   */
  private registerKeyboardListeners(): void {
    const keyDownHandler = (e: KeyboardEvent) => {
      this.handleKeyboardInput(e.key.toLowerCase(), true);
    };

    const keyUpHandler = (e: KeyboardEvent) => {
      this.handleKeyboardInput(e.key.toLowerCase(), false);
    };

    window.addEventListener('keydown', keyDownHandler);
    window.addEventListener('keyup', keyUpHandler);

    this.keyboardListeners.set('keydown', keyDownHandler as any);
    this.keyboardListeners.set('keyup', keyUpHandler as any);
  }

  /**
   * 處理鍵盤輸入
   */
  private handleKeyboardInput(key: string, pressed: boolean): void {
    let controlType: ControlType | null = null;

    switch (key) {
      case 'w':
        controlType = 'accelerate' as ControlType;
        break;
      case 's':
        controlType = 'brake' as ControlType;
        break;
      case 'a':
        controlType = 'turn_left' as ControlType;
        break;
      case 'd':
        controlType = 'turn_right' as ControlType;
        break;
    }

    if (controlType && this.allowedControls.has(controlType)) {
      this.updateInputState(controlType, pressed);
    }
  }

  /**
   * 註冊虛擬按鈕監聽器（行動裝置）
   */
  registerVirtualButton(buttonId: string, controlType: ControlType): void {
    if (!this.allowedControls.has(controlType)) {
      return; // 不允許的控制項目不註冊
    }

    const button = document.getElementById(buttonId);
    if (!button) return;

    const touchStartHandler = (e: TouchEvent | MouseEvent) => {
      e.preventDefault();
      this.updateInputState(controlType, true);
    };

    const touchEndHandler = (e: TouchEvent | MouseEvent) => {
      e.preventDefault();
      this.updateInputState(controlType, false);
    };

    // 支援觸控和滑鼠事件
    button.addEventListener('touchstart', touchStartHandler);
    button.addEventListener('mousedown', touchStartHandler);
    button.addEventListener('touchend', touchEndHandler);
    button.addEventListener('mouseup', touchEndHandler);
    button.addEventListener('touchcancel', touchEndHandler);

    this.touchListeners.set(`${buttonId}-start`, touchStartHandler);
    this.touchListeners.set(`${buttonId}-end`, touchEndHandler);
  }

  /**
   * 更新輸入狀態
   */
  private updateInputState(controlType: ControlType, pressed: boolean): void {
    switch (controlType) {
      case 'accelerate':
        this.inputState.accelerate = pressed;
        break;
      case 'brake':
        this.inputState.brake = pressed;
        break;
      case 'turn_left':
        this.inputState.turnLeft = pressed;
        break;
      case 'turn_right':
        this.inputState.turnRight = pressed;
        break;
    }

    this.sequenceNumber++;
    this.inputState.sequenceNumber = this.sequenceNumber;
  }

  /**
   * 獲取當前輸入狀態
   */
  getCurrentInputState(): InputState {
    return { ...this.inputState };
  }

  /**
   * 處理輸入事件（用於外部調用）
   */
  handleInput(input: InputEvent): void {
    if (this.allowedControls.has(input.type)) {
      this.updateInputState(input.type, input.pressed);
    }
  }

  /**
   * 更新允許的控制項目
   */
  updateAllowedControls(controls: ControlType[]): void {
    this.allowedControls = new Set(controls);
  }

  /**
   * 移除所有監聽器
   */
  dispose(): void {
    // 移除鍵盤監聽器
    this.keyboardListeners.forEach((handler, event) => {
      window.removeEventListener(event, handler as any);
    });
    this.keyboardListeners.clear();

    // 移除觸控監聽器
    this.touchListeners.forEach((handler, key) => {
      const parts = key.split('-');
      const buttonId = parts[0];
      const eventType = parts[1];
      
      if (!buttonId) return;
      
      const button = document.getElementById(buttonId);
      if (button) {
        if (eventType === 'start') {
          button.removeEventListener('touchstart', handler);
          button.removeEventListener('mousedown', handler);
        } else {
          button.removeEventListener('touchend', handler);
          button.removeEventListener('mouseup', handler);
          button.removeEventListener('touchcancel', handler);
        }
      }
    });
    this.touchListeners.clear();
  }
}
