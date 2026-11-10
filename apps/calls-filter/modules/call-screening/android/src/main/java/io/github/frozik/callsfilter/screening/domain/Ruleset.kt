package io.github.frozik.callsfilter.screening.domain

enum class Action { BLOCK, PASS }

/** «A repeat rings»: when a rule blocks, a second call within the group's window rings anyway. */
sealed interface RepeatPass {
  fun isOn(nowEpochMs: Long): Boolean

  data object Off : RepeatPass {
    override fun isOn(nowEpochMs: Long): Boolean = false
  }

  data object Always : RepeatPass {
    override fun isOn(nowEpochMs: Long): Boolean = true
  }

  data class Until(val epochMs: Long) : RepeatPass {
    override fun isOn(nowEpochMs: Long): Boolean = nowEpochMs < epochMs
  }
}

enum class GroupKind { CUSTOM, MY_CONTACTS, STRANGERS }

enum class NameField { NETWORK, CONTACT, ANY }

enum class SpecialMask { HIDDEN, FOREIGN, PREMIUM_RATE, VOIP, TOLL_FREE }

sealed interface Member {
  data class Number(val regex: Regex) : Member

  data class Name(val regex: Regex, val field: NameField) : Member

  data class Special(val mask: SpecialMask) : Member

  data class Contact(val numbers: List<String>, val lookupKey: String) : Member
}

/** Half-open `[from, to)` in floating minutes: local wall-clock minutes since 1970, no time zone. */
data class Window(val from: Long, val to: Long) {
  fun contains(minute: Long): Boolean = minute >= from && minute < to
}

enum class CalendarMode { EXCEPT_EVENTS, ONLY_DURING_EVENTS }

sealed interface CalendarSource {
  data class Device(val accountType: String, val accountName: String, val calendarName: String) : CalendarSource

  data class Ics(val id: String) : CalendarSource
}

data class EventFilter(val skipDeclined: Boolean, val includeAllDay: Boolean, val minutesBefore: Int, val minutesAfter: Int)

data class CalendarRule(val mode: CalendarMode, val filter: EventFilter, val source: CalendarSource, val bakedEvents: List<Window>)

data class Scheduled(
  val action: Action,
  val hasSchedule: Boolean,
  val windows: List<Window>,
  val calendars: List<CalendarRule>,
  /** The IANA zone whose clock the windows are on; `null` for the phone's own. */
  val zone: String? = null,
  val places: List<PlaceRule> = emptyList(),
)

enum class PlaceMode { ONLY_AT, EXCEPT_AT }

/** Where the phone must (or must not) be for the scheduled action; its state comes from the geofences. */
data class PlaceRule(val id: String, val mode: PlaceMode)

enum class UntilKind { INSTANT, FIRST_PASS, END_OF_EVENT }

data class TemporaryPolicy(val action: Action, val until: UntilKind, val untilEpochMs: Long, val setAtEpochMs: Long)

data class Group(
  val id: String,
  val kind: GroupKind,
  val include: List<Member>,
  val exclude: List<Member>,
  val excludeMyContacts: Boolean,
  val otherwise: Action,
  val scheduled: Scheduled?,
  val repeatWindowMinutes: Int,
  val temporary: TemporaryPolicy?,
  val createdAtEpochMs: Long,
  val autoReplyText: String,
  val repeatPass: RepeatPass = RepeatPass.Off,
  /** A custom group's name, for the shade; empty for the special two. */
  val name: String = "",
)

data class GroupChoice(val id: String, val name: String)

/** The book as the app compiled it: masks as regexes, schedules as windows. */
data class Ruleset(
  val schema: Int,
  val compiledAtEpochMs: Long,
  val horizonEndMinute: Long,
  val homeCountry: String,
  val groups: List<Group>,
  /** The groups the shade offers after a stranger's call rang through, most used first. */
  val whereTo: List<GroupChoice> = emptyList(),
  /** The filter-wide «a repeat rings», over every group's own. */
  val repeatPass: RepeatPass = RepeatPass.Off,
) {
  companion object {
    /** The published language's major version this service reads. */
    const val SCHEMA = 1
  }
}
