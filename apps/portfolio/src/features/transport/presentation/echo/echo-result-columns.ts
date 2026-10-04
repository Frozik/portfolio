import type { IColumn } from '@frozik/table/react/column';
import { reactColumn } from '@frozik/table/react/column';

import type { TransportProtocol } from '../../domain/connection';
import type { EchoResult, EchoVerdict } from '../../domain/echo';
import { bytesPerSecond } from '../../domain/echo';
import { formatBytes, formatRate } from '../common/format';
import { transportT } from '../translations';

const define = reactColumn<EchoResult>();

const PROTOCOL_WIDTH = 190;
const NUMBER_WIDTH = 110;
const VERDICT_WIDTH = 120;

export function echoResultColumns(): readonly IColumn<EchoResult, unknown>[] {
  return [
    define({
      id: 'protocol',
      title: transportT.echo.columns.protocol,
      kind: 'text',
      value: result => result.protocol ?? 'unknown',
      format: (protocol: TransportProtocol | 'unknown') =>
        protocol === 'unknown'
          ? transportT.echo.unknownProtocol
          : transportT.connection.protocols[protocol],
      width: PROTOCOL_WIDTH,
    }),
    define({
      id: 'size',
      title: transportT.echo.columns.size,
      kind: 'number',
      value: result => result.summary.bytes,
      format: (bytes: number) => formatBytes(bytes),
      width: NUMBER_WIDTH,
    }),
    define({
      id: 'speed',
      title: transportT.echo.columns.speed,
      kind: 'number',
      value: result => bytesPerSecond(result.summary.bytes, result.elapsedMs),
      format: (rate: number) => formatRate(rate),
      width: NUMBER_WIDTH,
    }),
    define({
      id: 'verdict',
      title: transportT.echo.columns.verdict,
      kind: 'text',
      value: result => result.verdict,
      format: (verdict: EchoVerdict) => transportT.echo.verdictShort[verdict],
      width: VERDICT_WIDTH,
    }),
  ];
}
