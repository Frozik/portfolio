package io.github.frozik.callsfilter.screening.adapters.proto

import com.google.protobuf.InvalidProtocolBufferException
import io.github.frozik.callsfilter.screening.domain.Action
import io.github.frozik.callsfilter.screening.domain.CalendarMode
import io.github.frozik.callsfilter.screening.domain.CalendarRule
import io.github.frozik.callsfilter.screening.domain.CalendarSource
import io.github.frozik.callsfilter.screening.domain.EventFilter
import io.github.frozik.callsfilter.screening.domain.Group
import io.github.frozik.callsfilter.screening.domain.GroupChoice
import io.github.frozik.callsfilter.screening.domain.GroupKind
import io.github.frozik.callsfilter.screening.domain.Member
import io.github.frozik.callsfilter.screening.domain.NameField
import io.github.frozik.callsfilter.screening.domain.PlaceMode
import io.github.frozik.callsfilter.screening.domain.PlaceRule
import io.github.frozik.callsfilter.screening.domain.RepeatPass
import io.github.frozik.callsfilter.screening.domain.Ruleset
import io.github.frozik.callsfilter.screening.domain.Scheduled
import io.github.frozik.callsfilter.screening.domain.SpecialMask
import io.github.frozik.callsfilter.screening.domain.TemporaryPolicy
import io.github.frozik.callsfilter.screening.domain.UntilKind
import io.github.frozik.callsfilter.screening.domain.Window
import io.github.frozik.callsfilter.screening.wire.Action as WireAction
import io.github.frozik.callsfilter.screening.wire.CalendarMode as WireCalendarMode
import io.github.frozik.callsfilter.screening.wire.CalendarRule as WireCalendarRule
import io.github.frozik.callsfilter.screening.wire.Group as WireGroup
import io.github.frozik.callsfilter.screening.wire.GroupKind as WireGroupKind
import io.github.frozik.callsfilter.screening.wire.Member as WireMember
import io.github.frozik.callsfilter.screening.wire.NameField as WireNameField
import io.github.frozik.callsfilter.screening.wire.PlaceMode as WirePlaceMode
import io.github.frozik.callsfilter.screening.wire.RepeatPass as WireRepeatPass
import io.github.frozik.callsfilter.screening.wire.RepeatPassKind as WireRepeatPassKind
import io.github.frozik.callsfilter.screening.wire.Ruleset as WireRuleset
import io.github.frozik.callsfilter.screening.wire.SpecialMask as WireSpecialMask
import io.github.frozik.callsfilter.screening.wire.UntilKind as WireUntilKind
import io.github.frozik.callsfilter.screening.wire.Window as WireWindow

/** Why bytes are not a ruleset this service can run: either way the call passes (fail-open). */
sealed interface RulesetFailure {
  data class Unreadable(val reason: String) : RulesetFailure

  data class UnknownSchema(val schema: Int) : RulesetFailure
}

sealed interface Decoded {
  data class Ok(val ruleset: Ruleset) : Decoded

  data class Failed(val failure: RulesetFailure) : Decoded
}

/** The published language into the domain: generated classes stop here. */
object RulesetDecoder {
  fun decode(bytes: ByteArray): Decoded {
    val wire =
      try {
        WireRuleset.parseFrom(bytes)
      } catch (failure: InvalidProtocolBufferException) {
        return Decoded.Failed(RulesetFailure.Unreadable(failure.message ?: "invalid protobuf"))
      }
    if (wire.schema != Ruleset.SCHEMA) {
      return Decoded.Failed(RulesetFailure.UnknownSchema(wire.schema))
    }
    return Decoded.Ok(
      Ruleset(
        schema = wire.schema,
        compiledAtEpochMs = wire.compiledAtEpochMs,
        horizonEndMinute = wire.horizonEndMinute,
        homeCountry = wire.homeCountry,
        groups = wire.groupsList.map(::group),
        whereTo = wire.whereToList.map { GroupChoice(it.id, it.name) },
        repeatPass = repeatPass(wire.repeatPass),
      ),
    )
  }

  private fun repeatPass(repeat: WireRepeatPass): RepeatPass = when (repeat.kind) {
    WireRepeatPassKind.REPEAT_PASS_KIND_ALWAYS -> RepeatPass.Always
    WireRepeatPassKind.REPEAT_PASS_KIND_UNTIL -> RepeatPass.Until(repeat.untilEpochMs)
    else -> RepeatPass.Off
  }

  private fun action(action: WireAction): Action = when (action) {
    WireAction.ACTION_BLOCK -> Action.BLOCK
    else -> Action.PASS
  }

  private fun kind(kind: WireGroupKind): GroupKind = when (kind) {
    WireGroupKind.GROUP_KIND_MY_CONTACTS -> GroupKind.MY_CONTACTS
    WireGroupKind.GROUP_KIND_STRANGERS -> GroupKind.STRANGERS
    else -> GroupKind.CUSTOM
  }

  private fun field(field: WireNameField): NameField = when (field) {
    WireNameField.NAME_FIELD_NETWORK -> NameField.NETWORK
    WireNameField.NAME_FIELD_CONTACT -> NameField.CONTACT
    else -> NameField.ANY
  }

  private fun special(mask: WireSpecialMask): SpecialMask? = when (mask) {
    WireSpecialMask.SPECIAL_MASK_HIDDEN -> SpecialMask.HIDDEN
    WireSpecialMask.SPECIAL_MASK_FOREIGN -> SpecialMask.FOREIGN
    WireSpecialMask.SPECIAL_MASK_PREMIUM_RATE -> SpecialMask.PREMIUM_RATE
    WireSpecialMask.SPECIAL_MASK_VOIP -> SpecialMask.VOIP
    WireSpecialMask.SPECIAL_MASK_TOLL_FREE -> SpecialMask.TOLL_FREE
    else -> null
  }

  /** A member this version cannot read matches nobody: a newer app's mask never blocks by accident. */
  private fun member(member: WireMember): Member? = when (member.kindCase) {
    WireMember.KindCase.NUMBER_REGEX -> Member.Number(Regex(member.numberRegex))
    WireMember.KindCase.NAME -> Member.Name(Regex(member.name.regex), field(member.name.field))
    WireMember.KindCase.SPECIAL -> special(member.special)?.let(Member::Special)
    WireMember.KindCase.CONTACT -> Member.Contact(member.contact.numbersList.toList(), member.contact.lookupKey)
    else -> null
  }

  private fun window(window: WireWindow): Window = Window(window.fromMinute, window.toMinute)

  private fun calendarRule(rule: WireCalendarRule): CalendarRule? {
    val source =
      when (rule.sourceCase) {
        WireCalendarRule.SourceCase.DEVICE ->
          CalendarSource.Device(rule.device.accountType, rule.device.accountName, rule.device.calendarName)

        WireCalendarRule.SourceCase.ICS_ID -> CalendarSource.Ics(rule.icsId)

        else -> return null
      }
    return CalendarRule(
      mode = if (rule.mode == WireCalendarMode.CALENDAR_MODE_ONLY_DURING_EVENTS) CalendarMode.ONLY_DURING_EVENTS else CalendarMode.EXCEPT_EVENTS,
      filter = EventFilter(
        skipDeclined = rule.filter.skipDeclined,
        includeAllDay = rule.filter.includeAllDay,
        minutesBefore = rule.filter.minutesBefore,
        minutesAfter = rule.filter.minutesAfter,
      ),
      source = source,
      bakedEvents = rule.bakedEventsList.map(::window),
    )
  }

  private fun group(group: WireGroup): Group {
    val policy = group.policy
    val scheduled =
      if (policy.hasScheduled()) {
        Scheduled(
          action = action(policy.scheduled.action),
          hasSchedule = policy.scheduled.hasSchedule,
          zone = policy.scheduled.zone.takeIf { it.isNotEmpty() },
          windows = policy.scheduled.windowsList.map(::window),
          calendars = policy.scheduled.calendarsList.mapNotNull(::calendarRule),
          places =
          policy.scheduled.placesList.map {
            PlaceRule(it.id, if (it.mode == WirePlaceMode.PLACE_MODE_EXCEPT_AT) PlaceMode.EXCEPT_AT else PlaceMode.ONLY_AT)
          },
        )
      } else {
        null
      }
    val temporary =
      if (group.hasTemporary()) {
        TemporaryPolicy(
          action = action(group.temporary.action),
          until =
          when (group.temporary.until) {
            WireUntilKind.UNTIL_KIND_FIRST_PASS -> UntilKind.FIRST_PASS
            WireUntilKind.UNTIL_KIND_END_OF_EVENT -> UntilKind.END_OF_EVENT
            else -> UntilKind.INSTANT
          },
          untilEpochMs = group.temporary.untilEpochMs,
          setAtEpochMs = group.temporary.setAtEpochMs,
        )
      } else {
        null
      }
    return Group(
      id = group.id,
      kind = kind(group.kind),
      include = group.includeList.mapNotNull(::member),
      exclude = group.excludeList.mapNotNull(::member),
      excludeMyContacts = group.excludeMyContacts,
      otherwise = action(policy.otherwise),
      scheduled = scheduled,
      repeatWindowMinutes = policy.repeatWindowMinutes,
      temporary = temporary,
      createdAtEpochMs = group.createdAtEpochMs,
      autoReplyText = group.autoReplyText,
      repeatPass = repeatPass(policy.repeatPass),
      name = group.name,
    )
  }
}
