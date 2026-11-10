package io.github.frozik.callsfilter.screening.adapters.android

/**
 * The steps that take a stored schema from one version to another, each keyed by the version it
 * starts from; `null` when one is missing, so the caller falls back to starting afresh.
 */
fun <T> migrationPlan(from: Int, to: Int, steps: Map<Int, T>): List<T>? = (from until to).map { version -> steps[version] ?: return null }
