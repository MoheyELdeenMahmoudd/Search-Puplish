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

    tabBtns.forEach(btn => {
        btn.addEventListener('click', e => {
            tabBtns.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
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
        // 1. تنظيف الشوائب المزعجة من وورد وجوجل دوكس
        html = html.replace(//gi, '');
        html = html.replace(/<\/?(o|st1|v):[^>]*>/gi, '');

        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // 2. إزالة الوسوم الخبيثة والستايلات
        Array.from(doc.querySelectorAll('script, style, iframe, noscript, meta, link, svg, button')).forEach(el => el.remove());

        // 3. فك وسوم SPAN و DIV بأمان شديد (هذا يمنع تكسير الأسطر مستقبلاً)
        Array.from(doc.querySelectorAll('span, div')).forEach(el => safeUnwrap(el));

        // 4. توحيد تنسيقات البولد
        Array.from(doc.querySelectorAll('b')).forEach(el => {
            const strong = doc.createElement('strong');
            strong.innerHTML = el.innerHTML;
            el.replaceWith(strong);
        });
        Array.from(doc.querySelectorAll('i')).forEach(el => {
            const em = doc.createElement('em');
            em.innerHTML = el.innerHTML;
            el.replaceWith(em);
        });

        // استخراج البولد المخفي في الستايلات
        Array.from(doc.querySelectorAll('*')).forEach(el => {
            if (el.style) {
                if (el.style.fontWeight === 'bold' || parseInt(el.style.fontWeight) >= 600) {
                    if (!['strong', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(el.tagName.toLowerCase())) {
                        el.innerHTML = `<strong>${el.innerHTML}</strong>`;
                    }
                }
                if (el.style.fontStyle === 'italic' && !['em'].includes(el.tagName.toLowerCase())) {
                     el.innerHTML = `<em>${el.innerHTML}</em>`;
                }
                el.removeAttribute('style');
            }
        });

        // 5. فلترة التاجات والسماح بالعناوين والقوائم
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

        // 🌟 6. الحل الجذري والآمن 100% لمشكلة البولد والروابط 🌟
        // نجمع الكلمات العادية مع البولد والروابط في "بلوك" واحد
        let pWrapper = null;
        const inlineTags = ['a', 'strong', 'em', 'img', 'br'];

        Array.from(doc.body.childNodes).forEach(node => {
            const isText = node.nodeType === Node.TEXT_NODE;
            const isInline = node.nodeType === Node.ELEMENT_NODE && inlineTags.includes(node.tagName.toLowerCase());

            if (isText || isInline) {
                // تجاهل المسافات البيضاء العشوائية
                if (isText && node.textContent.trim() === '') return;
                
                // ترك الـ Shortcodes في حالها
                if (isText && node.textContent.trim().startsWith('[') && node.textContent.trim().endsWith(']')) {
                    pWrapper = null;
                    return;
                }

                if (!pWrapper) {
                    pWrapper = doc.createElement('p');
                    doc.body.insertBefore(pWrapper, node);
                }
                pWrapper.appendChild(node);
            } else {
                pWrapper = null; // إغلاق الفقرة والبدء من جديد إذا لقينا عنوان H2 أو غيره
            }
        });

        // 7. تأمين الروابط
        Array.from(doc.querySelectorAll('a')).forEach(link => {
            const href = link.getAttribute('href') || '';
            if (!/^(https?|mailto|tel|whatsapp|sms):/i.test(href) && !href.startsWith('/') && !href.startsWith('#')) {
                link.removeAttribute('href');
            }
            if (link.getAttribute('target') === '_blank') {
                link.setAttribute('rel', 'noopener noreferrer');
            }
        });

        // 8. إزالة الوسوم الفارغة
        Array.from(doc.querySelectorAll('p, h1, h2, h3, h4, h5, h6, strong, em, li')).forEach(el => {
            if (el.innerHTML.trim() === '' || el.innerHTML === '<br>') el.remove();
        });

        // منع تعدد H1
        const h1s = Array.from(doc.querySelectorAll('h1'));
        if (h1s.length > 1) {
            h1s.slice(1).forEach(h1 => {
                const h2 = doc.createElement('h2');
                h2.innerHTML = h1.innerHTML;
                h1.replaceWith(h2);
            });
        }

        // 9. الإخراج
        let finalCode = doc.body.innerHTML;
        finalCode = finalCode.replace(/&nbsp;|\u00A0/g, ' ');
        
        // استبدال المسافات الزائدة بين التاجات بـ "مسافة" بدلاً من "سطر جديد" (هذا اللي كان بيكسر الأسطر)
        finalCode = finalCode.replace(/>\s+</g, '> <');
        finalCode = finalCode.replace(/<\/(p|h1|h2|h3|h4|h5|h6|ul|ol|table|blockquote)>/gi, '</$1>\n\n');
        finalCode = finalCode.replace(/\n\s*\n/g, '\n\n');

        return finalCode.trim();
    }

    cleanBtn.addEventListener('click', () => {
        try {
            let rawHTML = currentMode === 'visual' ? visualEditor.innerHTML : codeEditor.value;
            
            // قمت بتخفيف قيد الفحص هنا ليعمل بمرونة مع أي شيء تنسخه
            if(!rawHTML.trim()) { 
                showToast("⚠️ أدخل محتوى أولاً!","error"); 
                return; 
            }

            outputArea.value = smartClean(rawHTML);
            showToast("✅ تم التنظيف وجمع الأسطر بنجاح!");
        } catch(err) {
            console.error("تفاصيل الخطأ:", err);
            showToast("❌ حدث خطأ، يرجى المحاولة مرة أخرى","error");
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
