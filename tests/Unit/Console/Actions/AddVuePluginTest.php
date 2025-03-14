<?php

namespace Fusion\Tests\Unit\Console\Actions;

use Fusion\Console\Actions\AddVuePlugin;
use Fusion\Tests\Unit\Base;
use Illuminate\Support\Facades\File;
use PHPUnit\Framework\Attributes\Test;
use Symfony\Component\Console\Input\ArrayInput;
use Symfony\Component\Console\Output\NullOutput;

class AddVuePluginTest extends Base
{
    private AddVuePlugin $action;

    protected function setUp(): void
    {
        parent::setUp();
        app()->setBasePath(__DIR__ . '/__test');

        File::ensureDirectoryExists(__DIR__ . '/__test/resources/js');
        File::put(base_path('resources/js/app.js'), $this->appJsOriginalString());

        $this->action = app()->make(AddVuePlugin::class, [
            'input' => new ArrayInput([]),
            'output' => new NullOutput,
        ]);
    }

    protected function tearDown(): void
    {
        File::deleteDirectory(__DIR__ . '/__test');
        parent::tearDown();
    }

    #[Test]
    public function can_add_fusion_plugin_to_app_entry()
    {
        $status = $this->action->handle();

        $this->assertNotEquals(1, $status);
        $this->assertEquals(File::get(base_path('resources/js/app.js')), $this->appJsExpectedString());
        $this->assertEquals(File::get(base_path('resources/js/app.js.backup')), $this->appJsOriginalString());
    }

    #[Test]
    public function can_add_fusion_plugin_to_app_ts_entry()
    {
        File::delete(base_path('resources/js/app.js'));
        File::put(base_path('resources/js/app.ts'), $this->appTsOriginalString());

        $status = $this->action->handle();

        $this->assertNotEquals(1, $status);
        $this->assertEquals(File::get(base_path('resources/js/app.ts')), $this->appTsExpectedString());
        $this->assertEquals(File::get(base_path('resources/js/app.ts.backup')), $this->appTsOriginalString());
    }

    private function appTsExpectedString(): string
    {
        return "import '../css/app.css';

import { createInertiaApp } from '@inertiajs/vue3';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import type { DefineComponent } from 'vue';
import { createApp, h } from 'vue';
import { ZiggyVue } from 'ziggy-js';
import { initializeTheme } from './composables/useAppearance';
import fusion from '@fusion/vue/vue';

// Extend ImportMeta interface for Vite...
declare module 'vite/client' {
    interface ImportMetaEnv {
        readonly VITE_APP_NAME: string;
        [key: string]: string | boolean | undefined;
    }

    interface ImportMeta {
        readonly env: ImportMetaEnv;
        readonly glob: <T>(pattern: string) => Record<string, () => Promise<T>>;
    }
}

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

createInertiaApp({
    title: (title) => `\${title} - \${appName}`,
    resolve: (name) => resolvePageComponent(`./pages/\${name}.vue`, import.meta.glob<DefineComponent>('./pages/**/*.vue')),
    setup({ el, App, props, plugin }) {
        createApp({ render: () => h(App, props) })
            .use(plugin)
            .use(ZiggyVue)
            .use(fusion)
            .mount(el);
    },
    progress: {
        color: '#4B5563',
    },
});

// This will set light / dark mode on page load...
initializeTheme();
";
    }

    private function appJsExpectedString(): string
    {
        return "import '../css/app.css';
import './bootstrap';

import {createInertiaApp} from '@inertiajs/vue3';
import {resolvePageComponent} from 'laravel-vite-plugin/inertia-helpers';
import {createApp, h} from 'vue';
import fusion from '@fusion/vue/vue';

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

createInertiaApp({
  title: (title) => `\${title} - \${appName}`,
  resolve: (name) =>
    resolvePageComponent(
      `./Pages/\${name}.vue`,
      import.meta.glob('./Pages/**/*.vue'),
    ),
  setup({el, App, props, plugin}) {
    return createApp({render: () => h(App, props)})
      .use(plugin)
      .use(fusion)
      .mount(el);
  },
  progress: {
    color: '#4B5563',
  },
});
";
    }

    private function appJsOriginalString(): string
    {
        return "import '../css/app.css';
import './bootstrap';

import {createInertiaApp} from '@inertiajs/vue3';
import {resolvePageComponent} from 'laravel-vite-plugin/inertia-helpers';
import {createApp, h} from 'vue';

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

createInertiaApp({
  title: (title) => `\${title} - \${appName}`,
  resolve: (name) =>
    resolvePageComponent(
      `./Pages/\${name}.vue`,
      import.meta.glob('./Pages/**/*.vue'),
    ),
  setup({el, App, props, plugin}) {
    return createApp({render: () => h(App, props)})
      .use(plugin)
      .mount(el);
  },
  progress: {
    color: '#4B5563',
  },
});
";
    }

    private function appTsOriginalString(): string
    {
        return "import '../css/app.css';

import { createInertiaApp } from '@inertiajs/vue3';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import type { DefineComponent } from 'vue';
import { createApp, h } from 'vue';
import { ZiggyVue } from 'ziggy-js';
import { initializeTheme } from './composables/useAppearance';

// Extend ImportMeta interface for Vite...
declare module 'vite/client' {
    interface ImportMetaEnv {
        readonly VITE_APP_NAME: string;
        [key: string]: string | boolean | undefined;
    }

    interface ImportMeta {
        readonly env: ImportMetaEnv;
        readonly glob: <T>(pattern: string) => Record<string, () => Promise<T>>;
    }
}

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

createInertiaApp({
    title: (title) => `\${title} - \${appName}`,
    resolve: (name) => resolvePageComponent(`./pages/\${name}.vue`, import.meta.glob<DefineComponent>('./pages/**/*.vue')),
    setup({ el, App, props, plugin }) {
        createApp({ render: () => h(App, props) })
            .use(plugin)
            .use(ZiggyVue)
            .mount(el);
    },
    progress: {
        color: '#4B5563',
    },
});

// This will set light / dark mode on page load...
initializeTheme();
";
    }
}
