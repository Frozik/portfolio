package io.github.frozik.callsfilter.screening.domain

/** How a member took a caller: the user named them, or a rule happens to cover them. */
private enum class MatchKind { EXPLICIT, PATTERN }

sealed interface Membership {
  data class One(val group: Group) : Membership

  data class Conflict(val groups: List<Group>) : Membership
}

private fun specialMatches(mask: SpecialMask, caller: Caller, networkCountry: String?): Boolean = when (mask) {
  SpecialMask.HIDDEN -> caller.number == null
  SpecialMask.FOREIGN -> caller.country != null && networkCountry != null && caller.country != networkCountry
  SpecialMask.PREMIUM_RATE -> caller.type == NumberType.PREMIUM_RATE || caller.type == NumberType.SHARED_COST
  SpecialMask.VOIP -> caller.type == NumberType.VOIP
  SpecialMask.TOLL_FREE -> caller.type == NumberType.TOLL_FREE
}

/** A contact's own name is the user's word for them; the operator's name only happens to fit. */
private fun nameMatch(member: Member.Name, caller: Caller): MatchKind? {
  val byContact = member.field != NameField.NETWORK && caller.contact != null && member.regex.matches(caller.contact.name)
  val byNetwork = member.field != NameField.CONTACT && caller.networkName != null && member.regex.matches(caller.networkName)
  return when {
    byContact -> MatchKind.EXPLICIT
    byNetwork -> MatchKind.PATTERN
    else -> null
  }
}

private fun match(member: Member, caller: Caller, networkCountry: String?): MatchKind? = when (member) {
  is Member.Number ->
    if (caller.number != null && member.regex.matches(caller.number)) MatchKind.PATTERN else null

  is Member.Name -> nameMatch(member, caller)

  is Member.Special -> if (specialMatches(member.mask, caller, networkCountry)) MatchKind.PATTERN else null

  is Member.Contact -> {
    val byNumber = caller.number != null && caller.number in member.numbers
    val byLookup = member.lookupKey.isNotEmpty() && caller.contact?.lookupKey == member.lookupKey
    if (byNumber || byLookup) MatchKind.EXPLICIT else null
  }
}

private fun excluded(members: List<Member>, caller: Caller, networkCountry: String?): Boolean = members.any { match(it, caller, networkCountry) != null }

fun claims(group: Group, caller: Caller, networkCountry: String?): Boolean = when (group.kind) {
  GroupKind.CUSTOM -> {
    if (excluded(group.exclude, caller, networkCountry)) {
      false
    } else {
      val kinds = group.include.map { match(it, caller, networkCountry) }
      val cutAsContact = group.excludeMyContacts && caller.contact != null
      MatchKind.EXPLICIT in kinds || (MatchKind.PATTERN in kinds && !cutAsContact)
    }
  }

  GroupKind.MY_CONTACTS -> caller.contact != null && !excluded(group.exclude, caller, networkCountry)

  GroupKind.STRANGERS -> false
}

/** The group of a caller among those `inForce`: exactly one, or a conflict the app has to settle fail-open. */
fun membership(ruleset: Ruleset, caller: Caller, networkCountry: String?, inForce: (Group) -> Boolean = { true }): Membership {
  val claimants = ruleset.groups.filter { it.kind != GroupKind.STRANGERS && claims(it, caller, networkCountry) && inForce(it) }
  return when (claimants.size) {
    0 -> Membership.One(ruleset.groups.first { it.kind == GroupKind.STRANGERS })
    1 -> Membership.One(claimants.single())
    else -> Membership.Conflict(claimants)
  }
}
