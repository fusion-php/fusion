<?php

namespace Fusion\Tests\Unit\Console\Actions;

use Fusion\Console\Actions\AddViteConfig;
use Fusion\Tests\Unit\Base;
use Illuminate\Support\Facades\File;
use PHPUnit\Framework\Attributes\Test;
use Symfony\Component\Console\Input\ArrayInput;
use Symfony\Component\Console\Output\NullOutput;

class AddViteConfigTest extends Base
{

    private AddViteConfig $action;

    public function setUp(): void
    {
        parent::setUp();
        app()->setBasePath(__DIR__.'/__test');

        File::ensureDirectoryExists(__DIR__.'/__test');
        File::put(base_path('vite.config.js'), $this->viteConfigOriginalString());

        $this->action = app()->make(AddViteConfig::class, [
            'input' => new ArrayInput([]),
            'output' => new NullOutput(),
        ]);
    }

    public function tearDown(): void
    {
        File::deleteDirectory(__DIR__.'/__test');
        parent::tearDown();
    }

    #[Test]
    public function can_update_vite_config()
    {
        $status = $this->action->handle();

        $this->assertNotEquals(1, $status);
        $this->assertEquals(File::get(base_path('vite.config.js')), $this->viteConfigExpectedString());
        $this->assertEquals(File::get(base_path('vite.config.js.backup')), $this->viteConfigOriginalString());
    }

    #[Test]
    public function can_update_vite_config_as_typescript_file()
    {
        File::move(base_path('vite.config.js'), base_path('vite.config.ts'));

        $status = $this->action->handle();

        $this->assertNotEquals(1, $status);
        $this->assertEquals(File::get(base_path('vite.config.ts')), $this->viteConfigExpectedString());
        $this->assertEquals(File::get(base_path('vite.config.ts.backup')), $this->viteConfigOriginalString());
    }

    private function viteConfigExpectedString(): string
    {
        return "import vue from '@vitejs/plugin-vue';
import autoprefixer from 'autoprefixer';
import laravel from 'laravel-vite-plugin';
import path from 'path';
import tailwindcss from 'tailwindcss';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import fusion from '@fusion/vue/vite';

export default defineConfig({
    plugins: [
      fusion(),
        laravel({
            input: ['resources/js/app.ts'],
            ssr: 'resources/js/ssr.ts',
            refresh: true,
        }),
        vue({
            template: {
                transformAssetUrls: {
                    base: null,
                    includeAbsolute: false,
                },
            },
        })
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './resources/js'),
            'ziggy-js': resolve(__dirname, 'vendor/tightenco/ziggy'),
        },
    },
    css: {
        postcss: {
            plugins: [tailwindcss, autoprefixer],
        },
    },
});
";
    }

    private function viteConfigOriginalString(): string
    {
        return "import vue from '@vitejs/plugin-vue';
import autoprefixer from 'autoprefixer';
import laravel from 'laravel-vite-plugin';
import path from 'path';
import tailwindcss from 'tailwindcss';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/js/app.ts'],
            ssr: 'resources/js/ssr.ts',
            refresh: true,
        }),
        vue({
            template: {
                transformAssetUrls: {
                    base: null,
                    includeAbsolute: false,
                },
            },
        }),
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './resources/js'),
            'ziggy-js': resolve(__dirname, 'vendor/tightenco/ziggy'),
        },
    },
    css: {
        postcss: {
            plugins: [tailwindcss, autoprefixer],
        },
    },
});
";
    }

}
