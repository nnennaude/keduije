module.exports = {
    "extends": "airbnb",
    "plugins": [
        "react",
        "jsx-a11y",
        "import"
    ],
    "rules": {
        "object-shorthand": 0,
        "no-underscore-dangle": 0,
        "prefer-template": 1,
        "comma-dangle": [2, {
            "functions": "ignore",
            "objects": "always-multiline"
        }],
        "no-unused-vars": 1,
        "dot-notation": 1,
        "no-param-reassign": 1,
        "no-unused-expressions": 1
    }
};