declare module 'tourguidejs' {
  export interface TourguideStep {
    selector?: string | null;
    step?: number;
    title: string;
    content: string;
    image?: string;
    width?: number;
    height?: number;
    layout?: string;
  }

  export interface TourguideOptions {
    root?: string | HTMLElement;
    selector?: string;
    animationspeed?: number;
    padding?: number;
    steps?: TourguideStep[];
    src?: string;
    restoreinitialposition?: boolean;
    preloadimages?: boolean;
    colors?: Record<string, string>;
    style?: Record<string, string>;
    keyboardNavigation?: boolean | Record<string, any>;
    onStart?: (options?: any) => void;
    onStop?: (options?: any) => void;
    onComplete?: () => void;
    onStep?: (currentStep?: any, type?: any) => void;
  }

  export default class Tourguide {
    constructor(options?: TourguideOptions);
    start(step?: number): void;
    next(): void;
    previous(): void;
    go(step: number): void;
    stop(): void;
    complete(): void;
    deinit(): void;
    get length(): number;
    get currentstep(): any;
  }
}

declare module 'tourguidejs/tourguide.esm.js' {
  import Tourguide from 'tourguidejs';
  export default Tourguide;
}
