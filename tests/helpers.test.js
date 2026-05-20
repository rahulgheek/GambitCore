// The actual function from your server code
function sanitizeText(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[<>&"'\/]/g, (c) => ({
        '<': '&lt;', '>': '&gt;', '&': '&amp;',
        '"': '&quot;', "'": '&#39;', '/': '&#x2F;'
    }[c]));
}

// 🎯 Defining our Jest Test Suite
describe('SanitizeText Utility', () => {

    // Test Case 1: Normal, safe strings
    test('should pass standard text through without changes', () => {
        expect(sanitizeText("e4")).toBe("e4");
    });

    // Test Case 2: Dangerous scripts
    test('should encode dangerous script tags into safe HTML entities', () => {
        const attack = "<script>alert('hack')</script>";
        const secured = sanitizeText(attack);
        
        expect(secured).toBe("&lt;script&gt;alert(&#39;hack&#39;)&lt;&#x2F;script&gt;");
    });

    // Test Case 3: Empty/Bad data inputs
    test('should return an empty string if given a non-string value', () => {
        expect(sanitizeText(null)).toBe('');
        expect(sanitizeText(12345)).toBe('');
    });
});