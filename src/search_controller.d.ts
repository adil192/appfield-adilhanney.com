import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Search from 'resource:///org/gnome/shell/ui/search.js';
import * as ShellEntry from 'resource:///org/gnome/shell/ui/shellEntry.js';

/**
 * @see https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/main/js/ui/searchController.js#L26
 * @version 50
 */
export const SearchController = GObject.registerClass({
    Properties: {
        'search-active': GObject.ParamSpec.boolean(
            'search-active', null, null,
            GObject.ParamFlags.READABLE,
            false),
    },
}, class _SearchController extends St.Widget {
    _showAppsButton: St.Button;
    _activePage: null;
    _searchActive: boolean;
    _entry: St.Entry;
    _text: Clutter.Text;
    _searchEntryKeyController: Clutter.KeyController;
    _iconClickedId: number;
    _searchResults: Search.SearchResultsView;
    _focusTrap: St.Widget;
    _stageKeyController: Clutter.KeyController;
    _clickGesture: Clutter.ClickGesture;

    /**
     * addProvider:
     *
     * Add a search provider to the controller.
     *
     * @param {object} provider - a search provider implementation
     */
    addProvider(provider);

    /**
     * removeProvider:
     *
     * Remove a search provider from the controller.
     *
     * @param {object} provider - a search provider implementation
     */
    removeProvider(provider);

    get searchActive(): boolean;
});
