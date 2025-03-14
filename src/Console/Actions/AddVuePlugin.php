<?php

/**
 * @author Aaron Francis <aarondfrancis@gmail.com|https://twitter.com/aarondfrancis>
 */

namespace Fusion\Console\Actions;

use Illuminate\Console\Concerns\InteractsWithIO;
use Illuminate\Support\Facades\File;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;

class AddVuePlugin
{
    use InteractsWithIO;

    private ?string $appEntry;

    public function __construct(InputInterface $input, OutputInterface $output)
    {
        $this->input = $input;
        $this->output = $output;
    }

    public function handle()
    {
        if (!$this->findAppEntry()) {
            return 1;
        }

        $appPath = base_path($this->appEntry);

        $content = File::get($appPath);

        // Check if fusion is already imported
        if (str_contains($content, '@fusion/vue/vue')) {
            $this->info("[Vue] Fusion is already imported in {$this->appEntry}!");

            return 0;
        }

        // Create backup only if we need to make changes
        $backupPath = base_path("{$this->appEntry}.backup");
        File::copy($appPath, $backupPath);

        try {
            // Add fusion import
            $content = $this->addFusionImport($content);

            // Add fusion plugin to createApp chain
            $content = $this->addFusionPlugin($content);

            // Write modified content back to file
            File::put($appPath, $content);

            $this->info("[Vue] Successfully added Fusion to {$this->appEntry}");
            $this->info("[Vue] Backup created at {$this->appEntry}.backup");

            return 0;
        } catch (\Exception $e) {
            // Restore from backup if something goes wrong
            if (File::exists($backupPath)) {
                File::copy($backupPath, $appPath);
                $this->error('[Vue] An error occurred. The original file has been restored from backup.');
                $this->error($e->getMessage());
            }

            return 1;
        }
    }

    private function addFusionImport(string $content): string
    {
        // Find the last import statement
        preg_match_all('/^import .+$/m', $content, $matches);

        if (empty($matches[0])) {
            throw new \Exception("Could not find import statements in {$this->appEntry}");
        }

        $lastImport = end($matches[0]);

        // Add fusion import after the last import
        return str_replace(
            $lastImport,
            $lastImport."\nimport fusion from '@fusion/vue/vue';",
            $content
        );
    }

    private function addFusionPlugin(string $content): string
    {
        // Find the createApp chain
        if (!preg_match('/createApp\(.*?mount\(el\);/s', $content, $matches)) {
            throw new \Exception("Could not find createApp chain in {$this->appEntry}");
        }

        $createAppChain = $matches[0];

        // Find the last .use() or createApp() before .mount()
        if (!preg_match('/(.+?)\.mount\(el\);$/s', $createAppChain, $matches)) {
            throw new \Exception('Could not parse createApp chain structure');
        }

        $beforeMount = trim($matches[1]);

        // Find the base indentation of the mount function
        preg_match('/^(\s+).mount\(/m', $content, $indentMatches);
        $baseIndent = $indentMatches[1] ?? '    ';

        // Add .use(fusion) with proper indentation
        $modifiedChain = $beforeMount."\n".$baseIndent.'.use(fusion)'."\n".$baseIndent.'.mount(el);';

        return str_replace($createAppChain, $modifiedChain, $content);
    }

    private function findAppEntry(): bool
    {
        $this->appEntry = collect(['resources/js/app.js', 'resources/js/app.ts'])
            ->filter(fn(string $configName) => File::exists(base_path($configName)))
            ->first();

        // Check if app.[js/ts] exists
        if (!$this->appEntry) {
            $this->error('[Vite] resources/js/app.[js/ts] not found!');

            return false;
        }

        return true;
    }
}
