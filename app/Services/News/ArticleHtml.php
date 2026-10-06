<?php

namespace App\Services\News;

use DOMDocument;
use DOMElement;
use DOMNode;

class ArticleHtml
{
    /** Keep editor formatting only; never store pasted scripts, links or arbitrary styles. */
    public function sanitize(string $html): string
    {
        $document = new DOMDocument;
        $previous = libxml_use_internal_errors(true);
        try {
            $document->loadHTML('<?xml encoding="UTF-8"><body>'.$html.'</body>', LIBXML_NONET);
            $body = $document->getElementsByTagName('body')->item(0);

            return $body ? $this->children($body) : '';
        } finally {
            libxml_clear_errors();
            libxml_use_internal_errors($previous);
        }
    }

    private function children(DOMNode $node): string
    {
        $result = '';
        foreach ($node->childNodes as $child) {
            if ($child->nodeType === XML_TEXT_NODE) {
                $result .= htmlspecialchars($child->textContent, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
            } elseif ($child instanceof DOMElement) {
                $tag = strtolower($child->tagName);
                if ($tag === 'img') {
                    $src = $child->getAttribute('src');
                    // Keep durable inserted images, never executable or temporary URLs.
                    if (preg_match('~^https?://~i', $src) || preg_match('~^/storage/news-images/[^\s]+$~', $src)) {
                        $result .= '<img src="'.htmlspecialchars($src, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8').'" alt="'.htmlspecialchars($child->getAttribute('alt'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8').'">';
                    }

                    continue;
                }
                if (in_array($tag, ['script', 'style', 'iframe', 'object', 'svg', 'math', 'template'], true)) {
                    continue;
                }
                $content = $this->children($child);
                if (! in_array($tag, ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'div', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'blockquote'], true)) {
                    $result .= $content;

                    continue;
                }
                $align = '';
                if (preg_match('/(?:^|;)\s*text-align\s*:\s*(left|center|right)\s*(?:;|$)/i', $child->getAttribute('style'), $match)) {
                    $align = ' style="text-align: '.strtolower($match[1]).'"';
                }
                $result .= $tag === 'br' ? '<br>' : "<{$tag}{$align}>{$content}</{$tag}>";
            }
        }

        return $result;
    }
}
