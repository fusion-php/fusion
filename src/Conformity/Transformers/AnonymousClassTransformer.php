<?php

namespace Fusion\Conformity\Transformers;

use Fusion\Fusion;
use InvalidArgumentException;
use PhpParser\Comment\Doc;
use PhpParser\Node;
use PhpParser\Node\Name;
use PhpParser\Node\Stmt\Class_;
use PhpParser\Node\Stmt\Namespace_;
use PhpParser\Node\Stmt\Return_;
use PhpParser\NodeVisitor;

class AnonymousClassTransformer extends Transformer
{
    /**
     * Imports we've collected while traversing
     */
    protected array $imports = [];

    public function shouldHandle(array $ast): bool
    {
        // Look for anonymous class returns
        return $this->findFirst($ast, fn(Node $node) => $node instanceof Return_ &&
                $node->expr instanceof Node\Expr\New_ &&
                $node->expr->class instanceof Class_ &&
                $node->expr->class->name === null
        ) !== null;
    }

    public function enterNode(Node $node): int|Node|null
    {
        // Capture use statements while removing them from the tree
        if ($node instanceof Node\Stmt\Use_) {
            $node->setAttribute('comments', null);
            $this->imports[] = $node;

            return NodeVisitor::REMOVE_NODE;
        }

        // Stop traversing when we hit the anonymous class return
        if ($node instanceof Return_ &&
            $node->expr instanceof Node\Expr\New_ &&
            $node->expr->class instanceof Class_ &&
            $node->expr->class->name === null) {
            return NodeVisitor::DONT_TRAVERSE_CURRENT_AND_CHILDREN;
        }

        // Remove everything else
        return NodeVisitor::REMOVE_NODE;
    }

    public function leaveNode(Node $node): ?Node
    {
        if (!$this->isAnonymousClassReturn($node)) {
            return null;
        }

        return $this->createNamespacedClass($node);
    }

    protected function isAnonymousClassReturn(Node $node): bool
    {
        return $node instanceof Return_ &&
            $node->expr instanceof Node\Expr\New_ &&
            $node->expr->class instanceof Class_ &&
            $node->expr->class->name === null;
    }

    protected function createNamespacedClass(Return_ $node): Namespace_
    {
        $namespace = $this->generateNamespace();
        $className = $this->generateClassName();

        // Create the class
        $class = new Class_(
            $className,
            [
                'extends' => new Name\FullyQualified(config('fusion.base_page')),
                'stmts' => $node->expr->class->stmts,
            ]
        );

        // Create the namespace with imports and class
        $namespace = new Namespace_(
            new Name($namespace),
            [...$this->imports, $class]
        );

        $namespace->setDocComment(new Doc($this->generateDocBlock()));

        return $namespace;
    }

    protected function generateClassName(): string
    {
        if (!$this->filename) {
            throw new InvalidArgumentException('Filename must be set.');
        }

        return pathinfo($this->filename, PATHINFO_FILENAME);
    }

    protected function generateNamespace(): string
    {
        if (!$this->filename) {
            throw new InvalidArgumentException('Filename must be set.');
        }

        $storage = Fusion::storage('PHP') . DIRECTORY_SEPARATOR;

        if (!str_contains($this->filename, $storage)) {
            throw new InvalidArgumentException("Path must contain [$storage].");
        }

        return str($this->filename)
            ->after($storage)
            ->replace('/', '\\')
            ->prepend('Fusion\\Generated\\')
            ->beforeLast('\\')
            ->value();
    }

    protected function generateDocBlock(): string
    {
        return <<<DOC
/**
 * This file was automatically generated by Fusion.
 * You should not edit it.
 */
DOC;
    }
}
