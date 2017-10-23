- namespace [%fileName%]

/*!
 * V4Fire Client Core
 * https://github.com/V4Fire/Client
 *
 * Released under the MIT license
 * https://github.com/V4Fire/Client/blob/master/LICENSE
 */

- include 'super/i-data'|b as placeholder

- template index() extends ['i-data'].index
	- overWrapper = false

	- block rootAttrs
		- super
		? Object.assign(rootAttrs, {':style': "{top: global.pageYOffset + 'px'}"})

	- block body
		- super
		- block window
			< .&__back
			< .&__wrapper v-if = ifOnce('hidden', mods.hidden !== 'true')
				< section.&__window
					< h1.&__title v-if = title || $slots.title
						+= self.slot('title')
							- block title
								{{ title }}

					< .&__content
						+= self.slot('body')
							- block content

					< .&__controls
						+= self.slot('control')
							- block controls
								< b-button &
									:mods = provideMods({theme: 'light', size: gt[mods.size]}) |
									@click = close
								.
									{{ `Close` }}
