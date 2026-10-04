/**
 * Browser APIs the TypeScript DOM lib does not describe yet. Every member is
 * optional where the platform may lack it, so call sites feature-detect
 * instead of assuming.
 */

declare global {
  interface PerformanceScriptTiming extends PerformanceEntry {
    readonly sourceURL: string;
    readonly sourceFunctionName: string;
    readonly invoker: string;
    readonly invokerType: string;
  }

  interface PerformanceLongAnimationFrameTiming extends PerformanceEntry {
    readonly blockingDuration: DOMHighResTimeStamp;
    readonly scripts: readonly PerformanceScriptTiming[];
  }

  interface MemoryInfo {
    readonly usedJSHeapSize: number;
    readonly totalJSHeapSize: number;
    readonly jsHeapSizeLimit: number;
  }

  interface Performance {
    readonly memory?: MemoryInfo;
  }

  interface NavigatorUABrandVersion {
    readonly brand: string;
    readonly version: string;
  }

  interface UADataValues {
    readonly brands?: readonly NavigatorUABrandVersion[];
    readonly platform?: string;
    readonly platformVersion?: string;
    readonly fullVersionList?: readonly NavigatorUABrandVersion[];
  }

  interface NavigatorUAData {
    readonly brands: readonly NavigatorUABrandVersion[];
    readonly platform: string;
    getHighEntropyValues(hints: readonly string[]): Promise<UADataValues>;
  }

  interface NetworkInformation {
    readonly effectiveType?: string;
    readonly rtt?: number;
    readonly downlink?: number;
    readonly saveData?: boolean;
  }

  interface Navigator {
    readonly userAgentData?: NavigatorUAData;
    readonly connection?: NetworkInformation;
    readonly deviceMemory?: number;
  }

  interface ReportingDeprecationBody extends ReportBody {
    readonly id?: string;
    readonly message?: string;
    readonly sourceFile?: string;
    readonly lineNumber?: number;
  }

  interface DisplayMediaStreamOptions {
    readonly preferCurrentTab?: boolean;
    readonly selfBrowserSurface?: 'include' | 'exclude';
    readonly surfaceSwitching?: 'include' | 'exclude';
    readonly monitorTypeSurfaces?: 'include' | 'exclude';
    readonly systemAudio?: 'include' | 'exclude';
  }
}

// oxlint-disable-next-line unicorn/require-module-specifiers -- a module with nothing of its own: the export only makes the global augmentation above legal
export {};
