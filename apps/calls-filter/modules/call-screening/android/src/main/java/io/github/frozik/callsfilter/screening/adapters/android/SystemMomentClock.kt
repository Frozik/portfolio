package io.github.frozik.callsfilter.screening.adapters.android

import io.github.frozik.callsfilter.screening.application.Clock
import io.github.frozik.callsfilter.screening.domain.Moment
import java.time.LocalDateTime
import java.time.ZoneOffset

private const val SECONDS_PER_MINUTE = 60L

/** The instant, and the wall-clock minute in the phone's current zone counted as floating time. */
object SystemMomentClock : Clock {
  override fun now(): Moment = Moment(System.currentTimeMillis(), LocalDateTime.now().toEpochSecond(ZoneOffset.UTC) / SECONDS_PER_MINUTE)
}
