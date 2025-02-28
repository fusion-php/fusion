<?php

/**
 * @author Aaron Francis <aarondfrancis@gmail.com>
 * @link https://aaronfrancis.com
 * @link https://twitter.com/aarondfrancis
 */

namespace Fusion\Console\Commands;

use Exception;
use Fusion\Fusion;
use Fusion\Models\Component;
use Fusion\Reflection\FusionPageReflection;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;

class Shim extends Command
{
    protected $signature = 'fusion:shim {src}';

    protected $description = 'Create a JavaScript shim for a Fusion page.';

    protected Component $component;

    public function handle()
    {
        $this->component = Component::where('src', $this->argument('src'))->firstOrFail();

        $class = $this->component->php_class;

        if (!class_exists($class)) {
            throw new Exception("Class {$class} does not exist.");
        }

        $instance = new $class;
        $reflector = new FusionPageReflection($instance);

        // @TODO types

        $props = $reflector->hasProperty('discoveredProps')
            // Procedural
            ? $reflector->getProperty('discoveredProps')->getValue($instance)
            // Class
            : $reflector->propertiesForState()->pluck('name')->all();

        $methods = $reflector->exposedActionMethods()->pluck('name')->all();

        $duplicates = collect($methods)->merge($props)->duplicates();

        if ($duplicates->isNotEmpty()) {
            throw new Exception(
                'Properties and actions must have unique names. The following share a name: ' . $duplicates->implode(', ')
            );
        }

        $state = collect($props)
            ->map(fn($prop) => json_encode($prop))
            ->implode(', ');

        $fusion = collect($methods)
            ->filter(fn($method) => Str::startsWith($method, 'fusion'))
            ->map(fn($action) => json_encode($action))
            ->implode(', ');

        $actions = collect($methods)
            ->reject(fn($method) => Str::startsWith($method, 'fusion'))
            ->map(fn($action) => json_encode($action))
            ->implode(', ');

        $destination = str(base_path($this->component->src))
            ->after(config('fusion.paths.js'))
            ->prepend(Fusion::storage('JavaScript'))
            ->replaceEnd('.vue', '.js')
            ->value();

        $js = <<<JS
import Pipeline from '@fusion/vue/pipeline';
import ActionFactory from '@fusion/vue/actionFactory';


export const state = [{$state}];
export const actions = [{$actions}];
export const fusionActions = [{$fusion}];

let cachedState;

export function useFusion(keys = [], props = {}) {
  const state = cachedState ? cachedState : new Pipeline(props).createState();

  if (!cachedState) {
    cachedState = state;
  }

  const all = {
    ...state,
    ...new ActionFactory([...actions, ...fusionActions], state),
  }

  const shouldExport = {};
  for (const key of keys) {
    if (key in all) {
      shouldExport[key] = all[key];
    }
  }

  return shouldExport;
}
JS;

        File::ensureDirectoryExists(dirname($destination));
        File::put($destination, $js);

        $this->component->update([
            'shim_path' => Str::chopStart($destination, base_path())
        ]);
    }
}
