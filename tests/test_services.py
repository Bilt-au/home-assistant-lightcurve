"""Service target resolution, and the mis-targeting it must not do."""

from __future__ import annotations

from homeassistant.core import Context

from custom_components.lightcurve.const import DEFAULT_PROFILE_ID
from custom_components.lightcurve.coordinator import (
    MAX_REMEMBERED_CONTEXTS,
    LightcurveCoordinator,
)
from custom_components.lightcurve.services import _resolve
from custom_components.lightcurve.store import Group, LightcurveStore


class FakeCall:
    """A stand-in for ServiceCall carrying only the data _resolve reads."""

    def __init__(self, **data) -> None:
        self.data = data


async def build(hass, groups: list[Group]) -> LightcurveCoordinator:
    store = LightcurveStore(hass)
    await store.async_load()
    for group in groups:
        await store.async_put_group(group)
    return LightcurveCoordinator(hass, store)


def group(identifier: str, name: str, members: list[str]) -> Group:
    return Group(
        id=identifier, name=name, members=members, profile_id=DEFAULT_PROFILE_ID
    )


async def test_no_target_means_every_group(hass):
    coordinator = await build(
        hass,
        [group("g_a", "A", ["light.a"]), group("g_b", "B", ["light.b"])],
    )
    assert len(_resolve(coordinator, FakeCall())) == 2


async def test_group_id_targets_exactly_one(hass):
    coordinator = await build(
        hass, [group("g_a", "A", ["light.a"]), group("g_b", "B", ["light.b"])]
    )
    resolved = _resolve(coordinator, FakeCall(group_id="g_b"))
    assert [g.id for g in resolved] == ["g_b"]


async def test_unknown_group_id_resolves_to_nothing(hass):
    coordinator = await build(hass, [group("g_a", "A", ["light.a"])])
    assert _resolve(coordinator, FakeCall(group_id="g_nope")) == []


async def test_a_member_bulb_resolves_to_its_group(hass):
    coordinator = await build(
        hass,
        [group("g_a", "A", ["light.a1", "light.a2"]), group("g_b", "B", ["light.b1"])],
    )
    resolved = _resolve(coordinator, FakeCall(entity_id=["light.a2"]))
    assert [g.id for g in resolved] == ["g_a"]


async def test_a_similarly_named_light_does_not_match(hass):
    """The mis-targeting this must never do.

    Resolving by substring would have let the group "Bath" claim
    light.bathroom_ceiling, so a pause aimed at one room would act on another.
    """
    coordinator = await build(hass, [group("g_bath", "Bath", ["light.bath_spot"])])
    resolved = _resolve(coordinator, FakeCall(entity_id=["light.bathroom_ceiling"]))
    assert resolved == [], "a foreign light must not resolve to a Lightcurve group"


async def test_a_group_name_appearing_in_an_unrelated_entity_does_not_match(hass):
    coordinator = await build(hass, [group("g_a", "Toilet", ["light.toilet_1"])])
    resolved = _resolve(coordinator, FakeCall(entity_id=["switch.toilet_extractor_fan"]))
    assert resolved == []


async def test_area_target_matches_groups_bound_to_that_area(hass):
    store = LightcurveStore(hass)
    await store.async_load()
    await store.async_put_group(
        Group(id="g_x", name="X", area_id="area_x", profile_id=DEFAULT_PROFILE_ID)
    )
    await store.async_put_group(
        Group(id="g_y", name="Y", area_id="area_y", profile_id=DEFAULT_PROFILE_ID)
    )
    coordinator = LightcurveCoordinator(hass, store)
    resolved = _resolve(coordinator, FakeCall(area_id="area_y"))
    assert [g.id for g in resolved] == ["g_y"]


# ------------------------------------------------------- context bookkeeping


async def test_context_pruning_evicts_the_oldest_not_an_arbitrary_one(hass):
    """Pruning must be ordered.

    A set prunes in hash order, which can evict a context whose command is still in
    flight — and that command's own state change then reads as a foreign one, raising
    the false override this bookkeeping exists to prevent.
    """
    coordinator = await build(hass, [group("g_a", "A", ["light.a"])])

    first = Context()
    coordinator._remember_context(first)
    for _ in range(MAX_REMEMBERED_CONTEXTS + 50):
        coordinator._remember_context(Context())

    newest = Context()
    coordinator._remember_context(newest)

    assert len(coordinator._contexts) <= MAX_REMEMBERED_CONTEXTS
    assert coordinator._is_ours(newest), "the newest context must survive pruning"
    assert not coordinator._is_ours(first), "the oldest should have been evicted first"


async def test_a_context_is_recognised_via_its_parent(hass):
    """A command we issue in response to a user action carries their context as
    parent, and must still be recognised as ours."""
    coordinator = await build(hass, [group("g_a", "A", ["light.a"])])
    ours = Context()
    coordinator._remember_context(ours)
    child = Context(parent_id=ours.id)
    assert coordinator._is_ours(child)


async def test_an_unknown_context_is_not_ours(hass):
    coordinator = await build(hass, [group("g_a", "A", ["light.a"])])
    assert not coordinator._is_ours(Context())
    assert not coordinator._is_ours(None)
