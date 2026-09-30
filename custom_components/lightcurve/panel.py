"""Sidebar panel registration and static hosting for the editor.

The built frontend is a single file checked into the repository, so installing from
HACS needs no build step on the user's machine.
"""

from __future__ import annotations

import logging
from pathlib import Path

from homeassistant.components import panel_custom
from homeassistant.components.http import StaticPathConfig
from homeassistant.core import HomeAssistant

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

PANEL_URL = f"/{DOMAIN}_static"
PANEL_FILENAME = "lightcurve-panel.js"
PANEL_TITLE = "Lightcurve"
PANEL_ICON = "mdi:chart-bell-curve-cumulative"


async def async_register_panel(hass: HomeAssistant) -> bool:
    """Serve the panel bundle and add it to the sidebar.

    Returns False when the bundle is absent rather than failing setup: the
    integration is fully usable without the editor, and a missing build artefact
    should not take the lights down with it.
    """
    bundle = Path(__file__).parent / "frontend" / PANEL_FILENAME
    if not bundle.is_file():
        _LOGGER.warning(
            "editor panel not registered: %s is missing. The integration works"
            " without it; run `npm run build` in frontend/ to produce it",
            bundle,
        )
        return False

    await hass.http.async_register_static_paths(
        [
            StaticPathConfig(
                PANEL_URL,
                str(bundle.parent),
                # The bundle is versioned by the integration, not by a content hash,
                # so caching it would serve a stale editor after an update.
                cache_headers=False,
            )
        ]
    )
    await panel_custom.async_register_panel(
        hass,
        webcomponent_name="lightcurve-panel",
        frontend_url_path=DOMAIN,
        module_url=f"{PANEL_URL}/{PANEL_FILENAME}",
        sidebar_title=PANEL_TITLE,
        sidebar_icon=PANEL_ICON,
        require_admin=True,
        config={},
    )
    return True


def async_remove_panel(hass: HomeAssistant) -> None:
    from homeassistant.components import frontend

    frontend.async_remove_panel(hass, DOMAIN)
