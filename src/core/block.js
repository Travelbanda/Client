'use strict';

/*!
 * V4Fire Client Core
 * https://github.com/V4Fire/Client
 *
 * Released under the MIT license
 * https://github.com/V4Fire/Client/blob/master/LICENSE
 */

import Async from 'core/async';

const
	$C = require('collection.js'),
	EventEmitter2 = require('eventemitter2').EventEmitter2,
	uuid = require('uuid');

/**
 * Map of available block statuses
 */
export const statuses = Object.createMap({
	destroyed: -1,
	inactive: 0,
	loading: 1,
	ready: 2,
	unloaded: 0
});

/**
 * Base class for BEM like develop
 */
export default class Block {
	/**
	 * Block unique id
	 */
	id: ?string;

	/**
	 * Link to a block node
	 */
	node: ?Element;

	/**
	 * Block model
	 */
	model: ?iBlock;

	/**
	 * Async object
	 */
	async: ?Async;

	/**
	 * Local event emitter
	 */
	localEvent: ?EventEmitter2;

	/**
	 * List of applied modifiers
	 */
	mods: ?Object;

	/**
	 * Map of available block statuses
	 */
	statuses = statuses;

	/**
	 * Block init status
	 * @protected
	 */
	__status: number = statuses.unloaded;

	/**
	 * Sets a new status to the current block
	 * @param value
	 */
	set status(value: number) {
		if (this.__status === value) {
			return;
		}

		this.__status = value = value in this.statuses ? value : 0;
		this.localEvent.emit(`block.status.${this.statuses[value]}`, value);

		if (this.model) {
			if (this.model.emit) {
				this.model.emit(`status-${this.statuses[value]}`, value);
			}

			this.model.blockStatus = this.statuses[value];
		}
	}

	/**
	 * Return the current block status
	 */
	get status(): number {
		return this.__status;
	}

	/**
	 * Returns the current block name
	 */
	get blockName(): string {
		return $C(this).get('model.componentName') || this.constructor.name.dasherize();
	}

	/**
	 * @param [id] - block id
	 * @param [node] - link to a block node
	 * @param [tpls] - map of templates
	 * @param [mods] - map of modifiers to apply
	 * @param [async] - instance of Async
	 * @param [localEvent] - instance of EventEmitter2
	 * @param [model] - model instance (Vue.js)
	 */
	constructor(
		{id, node, tpls, mods, async, localEvent, model}: {
			id?: string,
			node?: Element,
			tpls?: Object,
			mods?: Object,
			async?: Async,
			localEvent?: EventEmitter2,
			model?: iBlock
		} = {}

	) {
		this.id = id || `b-${uuid()}`;
		this.async = async || new Async(this);
		this.localEvent = localEvent || new EventEmitter2({maxListeners: 100, wildcard: true});
		this.mods = {};
		this.node = node;
		this.tpls = tpls;

		// Two way binding with a Vue.js instance
		if (model) {
			this.model = model;
			model.block = this;
		}

		if (node) {
			node.classList.add(this.blockName, 'i-block-helper');
		}

		this.localEvent.once(`block.status.loading`, () => {
			if (mods) {
				const
					keys = Object.keys(mods);

				for (let i = 0; i < keys.length; i++) {
					const name = keys[i];
					this.setMod(name, mods[name]);
				}
			}
		});

		this.status = this.statuses.loading;
	}

	destructor() {
		this.status = this.statuses.destroyed;
		this.async.clearAll();
		this.localEvent.removeAllListeners();
	}

	/**
	 * Returns the full name of the current block
	 *
	 * @param [modName]
	 * @param [modValue]
	 */
	getFullBlockName(modName?: string, modValue?: any): string {
		return this.blockName + (modName ? `_${modName.dasherize()}_${String(modValue).dasherize()}` : '');
	}

	/**
	 * Returns the full name of the specified element
	 *
	 * @param elName
	 * @param [modName]
	 * @param [modValue]
	 */
	getFullElName(elName: string, modName?: string, modValue?: any): string {
		const modStr = modName ? `_${modName.dasherize()}_${String(modValue).dasherize()}` : '';
		return `${this.blockName}__${elName.dasherize()}${modStr}`;
	}

	/**
	 * Returns CSS selector for the specified element
	 *
	 * @param elName
	 * @param [mods]
	 */
	getElSelector(elName: string, mods?: Object): string {
		const
			sel = `.${this.getFullElName(elName)}`;

		let
			res = `${sel}.${this.id}`;

		if (mods) {
			const
				keys = Object.keys(mods);

			for (let i = 0; i < keys.length; i++) {
				const name = keys[i];
				res += `${sel}_${name}_${mods[name]}`;
			}
		}

		return res;
	}

	/**
	 * Returns block child elements by the specified request
	 *
	 * @param elName
	 * @param [mods]
	 */
	elements(elName: string, mods?: Object): Array<Element> {
		return this.node.querySelectorAll(this.getElSelector(elName, mods));
	}

	/**
	 * Returns a child element by the specified request
	 *
	 * @param elName
	 * @param [mods]
	 */
	element(elName: string, mods?: Object): Array<Element> {
		return this.node.query(this.getElSelector(elName, mods));
	}

	/**
	 * Sets a block modifier
	 *
	 * @param name
	 * @param value
	 */
	setMod(name: string, value: any): boolean {
		value = String(value);

		const
			prev = this.mods[name];

		if (prev !== value) {
			this.removeMod(name);

			this.mods[name] = value;
			this.node.classList.add(this.getFullBlockName(name, value));

			const event = {
				event: 'block.mod.set',
				type: 'set',
				name,
				value,
				prev
			};

			this.localEvent.emit(`block.mod.set.${name}.${value}`, event);
			this.model && this.model.emit && this.model.emit(`mod_set_${name}_${value}`, event);
			return true;
		}

		return false;
	}

	/**
	 * Removes a block modifier
	 *
	 * @param name
	 * @param [value]
	 */
	removeMod(name: string, value?: any): boolean {
		const
			current = this.mods[name];

		if (name in this.mods && (value === undefined || current === String(value))) {
			delete this.mods[name];
			this.node.classList.remove(this.getFullBlockName(name, current));

			const event = {
				event: 'block.mod.remove',
				type: 'remove',
				name,
				value: current
			};

			this.localEvent.emit(`block.mod.remove.${name}.${current}`, event);
			this.model && this.model.emit && this.model.emit(`mod_remove_${name}_${current}`, event);
			return true;
		}

		return false;
	}

	/**
	 * Returns a value of the specified block modifier
	 * @param mod
	 */
	getMod(mod: string): ?string {
		return this.mods[mod];
	}

	/**
	 * Sets a modifier to the specified element
	 *
	 * @param link - link to the element
	 * @param elName
	 * @param modName
	 * @param value
	 */
	setElMod(link: Element, elName: string, modName: string, value: any): boolean {
		value = String(value);

		if (this.getElMod(link, elName, modName) !== value) {
			this.removeElMod(link, elName, modName);

			link.classList.add(
				this.getFullElName(elName, modName, value)
			);

			this.localEvent.emit(`el.mod.set.${elName}.${modName}.${value}`, {
				element: elName,
				event: 'el.mod.set',
				type: 'set',
				link,
				modName,
				value
			});

			return true;
		}

		return false;
	}

	/**
	 * Removes a modifier from the specified element
	 *
	 * @param link - link to the element
	 * @param elName
	 * @param modName
	 * @param [value]
	 */
	removeElMod(link: Element, elName: string, modName: string, value?: any): boolean {
		const
			current = this.getElMod(link, elName, modName);

		if (current !== undefined && (value === undefined || current === String(value))) {
			link.classList.remove(
				this.getFullElName(elName, modName, current)
			);

			this.localEvent.emit(`el.mod.remove.${elName}.${modName}.${current}`, {
				element: elName,
				event: 'el.mod.remove',
				type: 'remove',
				link,
				modName,
				value: current
			});

			return true;
		}

		return false;
	}

	/**
	 * Returns a value of a modifier from the specified element
	 *
	 * @param link - link to the element
	 * @param elName
	 * @param modName
	 */
	getElMod(link: Element, elName: string, modName: string): ?string {
		const rgxp = new RegExp(`^${this.getFullElName(elName)}_${modName}_`);
		const el = $C(link.classList).one.get((el) => rgxp.test(el));
		return el && el.split(/_+/)[3];
	}
}
