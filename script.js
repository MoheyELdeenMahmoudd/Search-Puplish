document.addEventListener('DOMContentLoaded', () => {

    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const visualEditor = document.getElementById('visualEditor');
    const codeEditor = document.getElementById('codeEditor');
    const outputArea = document.getElementById('outputArea');
    const cleanBtn = document.getElementById('cleanBtn');
    const copyBtn = document.getElementById('copyBtn');
    const clearBtn = document.getElementById('clearBtn');

    let currentMode = 'visual';

    Array.from(tabBtns).forEach(btn => {
        btn.addEventListener('click', e => {
            Array.from(tabBtns).forEach(t => t.classList.remove('active'));
            Array.from(tabContents).forEach(c => c.classList.remove('active'));
            const target = e.currentTarget;
            target.classList.add('active');
            currentMode = target.getAttribute('data-tab');
            document.getElementById(`${currentMode}-tab`).classList.add('active');
        });
    });

    function showToast(msg, type = 'success') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = msg;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    function safeUnwrap(el) {
        const parent = el.parentNode;
        if (!parent) return;
        while (el.firstChild) parent.insertBefore(el.firstChild, el);
        parent.removeChild(el);
    }

    function smartClean(html) {
        // 1. التنظيف الأولي للشوائب
        html = html.replace(//gi, '');
        html = html.replace(/<\/?o:[^>]*>/gi, ''); // تنظيف أكواد الوورد المزعجة
        html = html.replace(/<\/?xml[^>]*>/gi, '');

        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        Array.from(doc.querySelectorAll('script, style, iframe, noscript, meta, link, svg')).forEach(el => el.remove());

        const blockTags = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'table', 'blockquote', 'figure', 'div'];

        // 2. معالجة الـ divs بذكاء (التي كانت تسبب كسر الأسطر)
        Array.from(doc.querySelectorAll('div')).forEach(div => {
            const hasBlock = Array.from(div.children).some(child => blockTags.includes(child.tagName.toLowerCase()));
            if (hasBlock) {
                safeUnwrap(div);
            } else {
                // إذا كان الـ div يحتوي على نصوص مضمنة، نحوله إلى فقرة P لربط الجمل ببعضها
                const p = doc.createElement('p');
                while (div.firstChild) p.appendChild(div.firstChild);
                div.replaceWith(p);
            }
        });

        // 3. توحيد وسوم البولد والمائل
        Array.from(doc.querySelectorAll('b')).forEach(el => {
            const strong = doc.createElement('strong');
            while(el.firstChild) strong.appendChild(el.firstChild);
            el.replaceWith(strong);
        });
        
        Array.from(doc.querySelectorAll('i')).forEach(el => {
            const em = doc.createElement('em');
            while(el.firstChild) em.appendChild(el.firstChild);
            el.replaceWith(em);
        });

        // 4. استخراج التنسيقات (Bold/Italic) المخفية في الستايلات
        Array.from(doc.querySelectorAll('*')).forEach(el => {
            if (!el.style) return;
            const fw = el.style.fontWeight || '';
            const fs = el.style.fontStyle || '';
            
            const isBold = fw === 'bold' || fw === 'bolder' || parseInt(fw, 10) >= 600;
            const isItalic = fs === 'italic';
            const tag = el.tagName.toLowerCase();

            if (isBold && !['strong', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
                const strong = doc.createElement('strong');
                while(el.firstChild) strong.appendChild(el.firstChild);
                el.appendChild(strong);
                el.style.fontWeight = '';
            }
            if (isItalic && tag !== 'em') {
                const em = doc.createElement('em');
                while(el.firstChild) em.appendChild(el.firstChild);
                el.appendChild(em);
                el.style.fontStyle = '';
            }
        });

        // منع تعدد الـ H1 في المقال للحفاظ على السيو
        const h1s = Array.from(doc.querySelectorAll('h1'));
        if (h1s.length > 1) {
            h1s.slice(1).forEach(h1 => {
                const h2 = doc.createElement('h2');
                while(h1.firstChild) h2.appendChild(h1.firstChild);
                h1.replaceWith(h2);
            });
        }

        // 5. إزالة الوسوم غير المسموح بها مع الحفاظ على ما بداخلها
        const allowedTags = ['p','h1','h2','h3','h4','h5','h6','ul','ol','li','strong','em','a','img','table','thead','tbody','tr','td','th','blockquote','br'];
        const allowedAttrs = ['href','src','alt','target','rel','colspan','rowspan', 'class', 'width', 'height'];
        
        Array.from(doc.body.querySelectorAll('*')).forEach(el => {
            if (!el.parentNode) return;
            
            if (!allowedTags.includes(el.tagName.toLowerCase())) {
                safeUnwrap(el);
            } else {
                Array.from(el.attributes).forEach(attr => {
                    if (!allowedAttrs.includes(attr.name.toLowerCase())) {
                        el.removeAttribute(attr.name);
                    }
                });
            }
        });

        // 6. حماية الروابط وتأمينها
        Array.from(doc.querySelectorAll('a')).forEach(link => {
            const href = link.getAttribute('href') || '';
            if (!/^(https?|mailto|tel|whatsapp|sms):/i.test(href) && !href.startsWith('/') && !href.startsWith('#')) {
                link.removeAttribute('href');
            }
            if (link.getAttribute('target') === '_blank') {
                let currentRel = link.getAttribute('rel') || '';
                if (!currentRel.includes('noopener')) {
                    link.setAttribute('rel', 'noopener noreferrer');
                }
            }
        });

        // 7. الحل الجذري لمشكلة تكسير الأسطر في الووردبريس
        // تجميع النصوص العادية + البولد + الروابط في فقرة متصلة <p> واحدة
        const inlineTags = ['a', 'strong', 'em', 'img', 'br'];
        let currentP = null;
        
        const childNodes = Array.from(doc.body.childNodes);
        
        childNodes.forEach(node => {
            const isText = node.nodeType === Node.TEXT_NODE;
            const isInlineEl = node.nodeType === Node.ELEMENT_NODE && inlineTags.includes(node.tagName.toLowerCase());
            
            if (isText && node.textContent.trim() === '') {
                if (!currentP) return; // تجاهل المسافات خارج الفقرات
            }

            if (isText || isInlineEl) {
                if (!currentP) {
                    currentP = doc.createElement('p');
                    node.parentNode.insertBefore(currentP, node);
                }
                currentP.appendChild(node);
            } else {
                currentP = null; // إغلاق الفقرة والبدء في فقرة جديدة إذا واجهنا عنصر بلوك (مثل صورة كبيرة أو عنوان)
            }
        });

        // 8. تنظيف الشوائب والوسوم الفارغة
        Array.from(doc.querySelectorAll('p, h2, h3, strong, em')).forEach(el => {
            if (el.innerHTML.trim() === '' || el.innerHTML === '<br>') {
                el.remove();
            } else if (el.tagName.toLowerCase() === 'p' && el.innerHTML.trim().startsWith('[') && el.innerHTML.trim().endsWith(']')) {
                safeUnwrap(el); // إخراج الشورت كود من الـ P حتى لا يعطله
            }
        });

        let finalCode = doc.body.innerHTML;
        finalCode = finalCode.replace(/&nbsp;|\u00A0/g, ' ');
        finalCode = finalCode.replace(/\t/g, '');
        
        // ترتيب نظيف للكود بدون إفساد الفقرات المتصلة
        finalCode = finalCode.replace(/<\/(p|h1|h2|h3|h4|h5|h6|ul|ol|table|blockquote)>/gi, '</$1>\n\n');
        finalCode = finalCode.replace(/\n\s*\n/g, '\n\n');
        
        return finalCode.trim();
    }

    cleanBtn.addEventListener('click', () => {
        try {
            let rawHTML = currentMode === 'visual' ? visualEditor.innerHTML : codeEditor.value;
            if(!rawHTML.trim() || !rawHTML.replace(/<[^>]*>/g, '').trim()) { 
                showToast("⚠️ أدخل محتوى نصي أولاً!","error"); 
                return; 
            }

            outputArea.value = smartClean(rawHTML);
            showToast("✅ تم تنظيف الكود وإصلاح التنسيقات!");
        } catch(err) {
            console.error(err);
            showToast("❌ حدث خطأ داخلي أثناء التنظيف","error");
        }
    });

    copyBtn.addEventListener('click', () => {
        const txt = outputArea.value.trim();
        if(!txt) { showToast("⚠️ لا يوجد محتوى للنسخ","error"); return; }
        navigator.clipboard.writeText(txt).then(() => showToast("📄 تم النسخ بنجاح!"));
    });

    clearBtn.addEventListener('click', () => {
        visualEditor.innerHTML = '';
        codeEditor.value = '';
        outputArea.value = '';
        showToast("🧹 تم مسح المحتوى");
    });

});
