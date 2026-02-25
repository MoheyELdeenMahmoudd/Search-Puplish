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
        // 1. التنظيف الأولي وحماية الـ Regex
        const commentRegex = new RegExp('<' + '!--[\\s\\S]*?--' + '>', 'gi');
        const wordRegex = new RegExp('<\\/?[a-z]+:[^>]*>', 'gi');
        const xmlRegex = new RegExp('<\\/?xml[^>]*>', 'gi');

        html = html.replace(commentRegex, '');
        html = html.replace(wordRegex, '');
        html = html.replace(xmlRegex, '');

        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        Array.from(doc.querySelectorAll('script, style, iframe, noscript, meta, link')).forEach(el => el.remove());

        // 2. فك الـ Divs بأمان
        Array.from(doc.querySelectorAll('div')).forEach(div => safeUnwrap(div));

        // 3. تحويل الوسوم القديمة
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

        // 4. صيد التنسيقات (Bold/Italic)
        Array.from(doc.querySelectorAll('*')).forEach(el => {
            if (!el.style) return;
            const fw = el.style.fontWeight || '';
            const fs = el.style.fontStyle || '';
            
            const isBold = fw === 'bold' || fw === 'bolder' || parseInt(fw, 10) >= 600;
            const isItalic = fs === 'italic';
            const tag = el.tagName.toLowerCase();

            if (isBold && !['strong', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
                el.innerHTML = `<strong>${el.innerHTML}</strong>`;
                el.style.fontWeight = '';
            }
            if (isItalic && tag !== 'em') {
                el.innerHTML = `<em>${el.innerHTML}</em>`;
                el.style.fontStyle = '';
            }
        });

        const h1s = Array.from(doc.querySelectorAll('h1'));
        if (h1s.length > 1) {
            h1s.slice(1).forEach(h1 => {
                const h2 = doc.createElement('h2');
                h2.innerHTML = h1.innerHTML;
                h1.replaceWith(h2);
            });
        }

        // 5. تصفية الوسوم والخصائص
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

        // 6. تأمين الروابط (بدون إضافة Nofollow أو الإجبار على فتح نافذة جديدة)
        Array.from(doc.querySelectorAll('a')).forEach(link => {
            const href = link.getAttribute('href') || '';
            // التأكد من صحة الرابط فقط
            if (!/^(https?|mailto|tel|whatsapp|sms):/i.test(href) && !href.startsWith('/') && !href.startsWith('#')) {
                link.removeAttribute('href');
            }
            
            // إضافة حماية أمنية فقط لو كان الرابط أصلاً مضبوط على فتح في نافذة جديدة
            if (link.getAttribute('target') === '_blank') {
                let currentRel = link.getAttribute('rel') || '';
                if (!currentRel.includes('noopener')) {
                    link.setAttribute('rel', 'noopener noreferrer');
                }
            }
        });

        // 7. تغليف النصوص الحرة بـ P
        Array.from(doc.body.childNodes).forEach(node => {
            if (node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== '') {
                if (node.textContent.trim().startsWith('[') && node.textContent.trim().endsWith(']')) {
                    return; // تجاهل الشورت كود
                }
                const p = doc.createElement('p');
                p.textContent = node.textContent;
                node.replaceWith(p);
            }
        });

        // 8. إزالة الوسوم الفارغة
        for(let i=0; i<3; i++){
            Array.from(doc.querySelectorAll('p, h2, h3, strong, em, li')).forEach(el => {
                if (el.innerHTML.trim() === '') {
                    el.remove();
                } else if (el.tagName.toLowerCase() === 'p' && el.innerHTML.trim().startsWith('[') && el.innerHTML.trim().endsWith(']')) {
                    safeUnwrap(el);
                }
            });
        }

        let finalCode = doc.body.innerHTML;
        finalCode = finalCode.replace(/&nbsp;|\u00A0/g, ' ');
        finalCode = finalCode.replace(/\t/g, '');
        finalCode = finalCode.replace(/>\s+</g, '>\n<');
        finalCode = finalCode.replace(/\n\s*\n/g, '\n');
        
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
            showToast("✅ تم تنظيف النصوص والأكواد بذكاء!");
        } catch(err) {
            console.error(err);
            showToast("❌ حدث خطأ داخلي أثناء التنظيف","error");
        }
    });

    copyBtn.addEventListener('click', () => {
        const txt = outputArea.value.trim();
        if(!txt) { showToast("⚠️ لا يوجد محتوى للنسخ","error"); return; }
        navigator.clipboard.writeText(txt).then(() => showToast("📄 تم النسخ!"));
    });

    clearBtn.addEventListener('click', () => {
        visualEditor.innerHTML = '';
        codeEditor.value = '';
        outputArea.value = '';
        showToast("🧹 تم مسح المحتوى");
    });

});