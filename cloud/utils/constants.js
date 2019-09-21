module.exports = {
    WEB_HOOK_SOURCE: {
        SPRING_BOARD: 'SPRING_BOARD',
        SHOPIFY: 'SHOPIFY'
    },

    SPRING_BOARD_WEB_HOOK_EVENTS: {
        ITEM_CREATED: 'item_created'
    },
    
    CLASS_NAME: {
        Style1Counter: 'Style1Counter'
    },

    DEPARTMENT_NAME_TO_CODE: {
        ACCESSORIES: '09',
        DISPLAYS: '06',
        'GIFT CERTIFICATES': '16',
        HANDICRAFTS: '01',
        MUSIC: '15',
        'MEN GARMENTS': '08',
        'BODY PIERCING': '12',
        PURSES: '11',
        SCENTS: '07',
        SHOES: '02',
        'SOLID SILVER': '13',
        'SILVER': '13',
        'SILVER WITH STONES': '03',
        VALIJA: '05',
        'WOMEN\'S GARMENTS': '04',
        BEAUTY: '10'
    },

    PRODUCT_MAPPING: {
        'custom.style_name': 'title',
        'long_description': 'body_html',
        // 'primary_image_id': 'image', //TODO: Don't we need to upload the image on shopify??
        'custom.class': 'product_type',
        'custom.style1': 'vendor'
    },

    DEFAULT_PRODUCT_DATA: {
        published_scope: 'global'
    },

    PRODUCT_VARIANT_MAPPING: {
        'price': 'price',
        'description': 'title',
        'public_id': 'sku',
        'custom.color': 'option1',
        'custom.size': 'option2',
        'custom.upc': 'barcode',
        'original_price': 'compare_at_price'
    },

    DEFAULT_VARIANT_DATA: {
        fulfillment_service: 'springboard-retail',
        inventory_management: 'springboard-retail'
    },

    VALID_HTTP_VERBS: {
        POST: 1,
        PUT: 1,
        GET: 1,
        DELETE: 1
    },

    DEFAULT_TAGS: [
        'BOHO CHIC',
        'BOHO',
        'BOHEMIAN',
        'RESORT',
        'TROPICAL',
        'WARM WEATHER',
        'RELAXED',
        'FLOWY',
        'LOOSE FIT',
        'PUERTO RICAN',
        'PUERTO RICO',
        'CARIBBEAN',
        'LATIN',
        'LATINA',
        'SHOP LOCAL',
        'TRAVELLER',
        'YOUNG',
        'HIP',
        'SOFT FABRICS',
        'FEMININE',
        'WOMEN',
        'ETHNIC',
        'BALI',
        'INDONESIA',
        'HAND PRINTED',
        'HAND MADE',
        'ISLAND',
        'BEACHWEAR',
        'BEACHY',
        'BEACH',
        'ISLAND LIFE',
        'ARTSY',
        'SOUTH KOREA',
        'SEOUL',
        'INDIA',
        'JUST ARRIVED'
    ]
};
