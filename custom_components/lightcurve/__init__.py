"""Lightcurve: drive lights along a user-defined 24-hour colour and brightness curve.

Setup order matters. The store has to be readable before the coordinator exists,
and the coordinator has to exist before any platform is forwarded, because every
entity reads its state from it.
"""

from __future__ import annotations

import logging

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ConfigEntryNotReady

from .const import DOMAIN, PLATFORMS
from .coordinator import LightcurveCoordinator
from .services import async_register_services, async_unregister_services
from .store import LightcurveStore, StoreError

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    store = LightcurveStore(hass)
    try:
        await store.async_load()
    except StoreError as err:
        # Unreadable storage is not transient, but raising ConfigEntryNotReady gives
        # the user a retry after they have fixed or removed the file, which beats a
        # hard failure they cannot act on.
        raise ConfigEntryNotReady(f"could not load Lightcurve storage: {err}") from err

    coordinator = LightcurveCoordinator(hass, store)
    hass.data.setdefault(DOMAIN, {})[entry.entry_id] = coordinator

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    await coordinator.async_setup()
    async_register_services(hass, coordinator)

    entry.async_on_unload(entry.add_update_listener(async_reload_entry))
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    unloaded = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if not unloaded:
        return False
    coordinator: LightcurveCoordinator = hass.data[DOMAIN].pop(entry.entry_id)
    await coordinator.async_shutdown()
    if not hass.data[DOMAIN]:
        hass.data.pop(DOMAIN)
        async_unregister_services(hass)
    return True


async def async_reload_entry(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Options changed: a full reload is the honest way to pick up a new tick rate."""
    await hass.config_entries.async_reload(entry.entry_id)
