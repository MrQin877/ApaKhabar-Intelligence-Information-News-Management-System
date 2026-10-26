<?php

namespace App\Services\Shorts;

use DOMDocument;
use DOMElement;
use DOMNode;

class ShortContent
{
    public static function text(?string $content): string
    {
        $spaced = preg_replace('~<br\s*/?>|</(?:p|div|li|blockquote)>~i', "\n", $content ?? '');
        $text = html_entity_decode(strip_tags($spaced), ENT_QUOTES | ENT_HTML5, 'UTF-8');

        return trim(preg_replace('/[\x{200B}-\x{200D}\x{FEFF}]/u', '', $text));
    }

    public static function length(?string $content): int
    {
        return mb_strlen(self::text($content));
    }

    public static function clean(?string $content): string
    {
        $content ??= '';
        if (! str_contains($content, '<')) {
            return $content;
        }

        $document = new DOMDocument;
        $previous = libxml_use_internal_errors(true);
        $document->loadHTML('<?xml encoding="utf-8"?><body>'.$content.'</body>', LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);
        libxml_clear_errors();
        libxml_use_internal_errors($previous);
        $body = $document->getElementsByTagName('body')->item(0);
        if (! $body) {
            return self::text($content);
        }
        self::cleanNode($body);

        $html = '';
        foreach ($body->childNodes as $node) {
            $html .= $document->saveHTML($node);
        }

        return $html;
    }

    private static function cleanNode(DOMNode $parent): void
    {
        $allowed = ['p', 'div', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'blockquote'];
        foreach (iterator_to_array($parent->childNodes) as $node) {
            if (! $node instanceof DOMElement) {
                continue;
            }
            if (in_array($node->tagName, ['script', 'style', 'iframe'], true)) {
                $parent->removeChild($node);
                continue;
            }
            self::cleanNode($node);
            if (! in_array($node->tagName, $allowed, true)) {
                while ($node->firstChild) {
                    $parent->insertBefore($node->firstChild, $node);
                }
                $parent->removeChild($node);
                continue;
            }
            $alignment = $node->getAttribute('style');
            while ($node->attributes->length) {
                $node->removeAttributeNode($node->attributes->item(0));
            }
            if (preg_match('/^\s*text-align\s*:\s*(left|center|right)\s*;?\s*$/i', $alignment, $match)) {
                $node->setAttribute('style', 'text-align: '.strtolower($match[1]).';');
            }
        }
    }
}
