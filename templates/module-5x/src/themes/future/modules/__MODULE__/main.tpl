<div class="__MODULE__-main">
    <h1>{$LANG->getModule('main')}</h1>
    {foreach $ITEMS as $item}
        <article>
            <a href="{$item.link}">{$item.title}</a>
        </article>
    {/foreach}
</div>
