;(function (define, undefined) {
    'use strict';
    define([
        'gettext', 'jquery', 'underscore', 'backbone', 'js/mustache', 'backbone-super'
    ], function (gettext, $, _, Backbone, RequireMustache) {

        var Mustache = window.Mustache || RequireMustache;

        var messageRevertDelay = 4000;
        var FieldViews = {};

        FieldViews.FieldView = Backbone.View.extend({
                
            fieldType: 'generic',

            className: function () {
                return 'u-field' + ' u-field-' + this.fieldType + ' u-field-' + this.options.valueAttribute;
            },

            tagName: 'div',

            indicators: {
                'canEdit': '<i class="icon fa fa-pencil message-can-edit" aria-hidden="true"></i>',
                'error': '<i class="fa fa-exclamation-triangle message-error" aria-hidden="true"></i>',
                'validationError': '<i class="fa fa-exclamation-triangle message-validation-error" aria-hidden="true"></i>',
                'inProgress': '<i class="fa fa-spinner fa-pulse message-in-progress" aria-hidden="true"></i>',
                'success': '<i class="fa fa-check message-success" aria-hidden="true"></i>',
                'plus': '<i class="fa fa-plus placeholder" aria-hidden="true"></i>'
            },

            messages: {
                'canEdit': '',
                'error': gettext('An error occurred. Please try again.'),
                'validationError': '',
                'inProgress': gettext('Saving'),
                'success': gettext('Your changes have been saved.')
            },

            initialize: function (options) {

                this.template = _.template($(this.templateSelector).text());

                this.helpMessage = this.options.helpMessage || '';
                this.showMessages = _.isUndefined(this.options.showMessages) ? true : this.options.showMessages;

                _.bindAll(this, 'modelValue', 'modelValueIsSet', 'message', 'getMessage', 'title',
                          'showHelpMessage', 'showInProgressMessage', 'showSuccessMessage', 'showErrorMessage');
            },

            modelValue: function () {
                return this.model.get(this.options.valueAttribute);
            },

            modelValueIsSet: function() {
                return (this.modelValue() == true);
            },

            message: function (message) {
                return this.$('.u-field-message').html(message);
            },

            title: function (text) {
                return this.$('.u-field-title').html(text);
            },

            getMessage: function(message_status) {
                if ((message_status + 'Message') in this) {
                    return this[message_status + 'Message'].call(this);
                } else if (this.showMessages) {
                    return this.indicators[message_status] + this.messages[message_status];
                }
                return this.indicators[message_status];
            },

            showCanEditMessage: function(show) {
                if (!_.isUndefined(show) && show) {
                    this.message(this.getMessage('canEdit'));
                } else {
                    this.message('');
                }
            },

            showHelpMessage: function () {
                this.message(this.helpMessage);
            },

            showInProgressMessage: function () {
                this.message(this.getMessage('inProgress'));
            },

            showSuccessMessage: function () {
                var successMessage = this.getMessage('success');
                this.message(successMessage);

                if (this.options.refreshPageOnSave) {
                    document.location.reload();
                }

                var view = this;

                var context = Date.now();
                this.lastSuccessMessageContext = context;

                setTimeout(function () {
                    if ((context === view.lastSuccessMessageContext) && (view.message().html() == successMessage)) {
                        view.showHelpMessage();
                    }
                }, messageRevertDelay);
            },

            showErrorMessage: function (xhr) {
                if (xhr.status === 400) {
                    try {
                        var errors = JSON.parse(xhr.responseText);
                        var validationErrorMessage = Mustache.escapeHtml(errors['field_errors'][this.options.valueAttribute]['user_message']);
                        var message = this.indicators['validationError'] + validationErrorMessage;
                        this.message(message);
                    } catch (error) {
                        this.message(this.getMessage('error'));
                    }
                } else {
                    this.message(this.getMessage('error'));
                }
            }
        });

        FieldViews.EditableFieldView = FieldViews.FieldView.extend({

            initialize: function (options) {
                _.bindAll(this, 'saveAttributes', 'saveSucceeded', 'showDisplayMode', 'showEditMode', 'startEditing', 'finishEditing');
                this._super(options);

                this.editable = _.isUndefined(this.options.editable) ? 'always': this.options.editable;
                this.$el.addClass('editable-' + this.editable);

                if (this.editable === 'always') {
                    this.showEditMode(false);
                } else {
                    this.showDisplayMode(false);
                }
            },

            saveAttributes: function (attributes, options) {
                var view = this;
                var defaultOptions = {
                    contentType: 'application/merge-patch+json',
                    patch: true,
                    wait: true,
                    success: function () {
                        view.saveSucceeded();
                    },
                    error: function (model, xhr) {
                        view.showErrorMessage(xhr);
                    }
                };
                this.showInProgressMessage();
                this.model.save(attributes, _.extend(defaultOptions, options));
            },

            saveSucceeded: function () {
                this.showSuccessMessage();
            },

            showDisplayMode: function(render) {
                this.mode = 'display';
                if (render) { this.render(); }

                this.$el.removeClass('mode-edit');

                this.$el.toggleClass('mode-hidden', (this.editable === 'never' && !this.modelValueIsSet()));
                this.$el.toggleClass('mode-placeholder', (this.editable === 'toggle' && !this.modelValueIsSet()));
                this.$el.toggleClass('mode-display', (this.modelValueIsSet()));
            },

            showEditMode: function(render) {
                this.mode = 'edit';
                if (render) { this.render(); }

                this.$el.removeClass('mode-hidden');
                this.$el.removeClass('mode-placeholder');
                this.$el.removeClass('mode-display');

                this.$el.addClass('mode-edit');
            },

            startEditing: function (event) {
                if (this.editable === 'toggle' && this.mode !== 'edit') {
                    this.showEditMode(true);
                }
            },

            finishEditing: function(event) {
                if (this.fieldValue() !== this.modelValue()) {
                    this.saveValue();
                } else {
                    if (this.editable === 'always') {
                        this.showEditMode(true);
                    } else {
                        this.showDisplayMode(true);
                    }
                }
            }
        });

        FieldViews.ReadonlyFieldView = FieldViews.FieldView.extend({

            fieldType: 'readonly',

            templateSelector: '#field_readonly-tpl',

            initialize: function (options) {
                this._super(options);
                _.bindAll(this, 'render', 'fieldValue', 'updateValueInField');
                this.listenTo(this.model, "change:" + this.options.valueAttribute, this.updateValueInField);
            },

            render: function () {
                this.$el.html(this.template({
                    id: this.options.valueAttribute,
                    title: this.options.title,
                    value: this.modelValue(),
                    message: this.helpMessage
                }));
                return this;
            },

            fieldValue: function () {
                return this.$('.u-field-value input').val();
            },

            updateValueInField: function () {
                this.$('.u-field-value input').val(Mustache.escapeHtml(this.modelValue()));
            }
        });

        FieldViews.TextFieldView = FieldViews.EditableFieldView.extend({

            fieldType: 'text',

            templateSelector: '#field_text-tpl',

            events: {
                'change input': 'saveValue'
            },

            initialize: function (options) {
                this._super(options);
                _.bindAll(this, 'render', 'fieldValue', 'updateValueInField', 'saveValue');
                this.listenTo(this.model, "change:" + this.options.valueAttribute, this.updateValueInField);
            },

            render: function () {
                this.$el.html(this.template({
                    id: this.options.valueAttribute,
                    title: this.options.title,
                    value: this.modelValue(),
                    message: this.helpMessage
                }));
                return this;
            },

            fieldValue: function () {
                return this.$('.u-field-value input').val();
            },

            updateValueInField: function () {
                var value = (_.isUndefined(this.modelValue()) || _.isNull(this.modelValue())) ? '' : this.modelValue();
                this.$('.u-field-value input').val(Mustache.escapeHtml(value));
            },

            saveValue: function (event) {
                var attributes = {};
                attributes[this.options.valueAttribute] = this.fieldValue();
                this.saveAttributes(attributes);
            }
        });

        FieldViews.DropdownFieldView = FieldViews.EditableFieldView.extend({

            fieldType: 'dropdown',

            templateSelector: '#field_dropdown-tpl',

            events: {
                'click': 'startEditing',
                'change select': 'finishEditing',
                'focusout select': 'finishEditing'
            },

            initialize: function (options) {
                _.bindAll(this, 'render', 'optionForValue', 'fieldValue', 'displayValue', 'updateValueInField', 'saveValue');
                this._super(options);

                this.listenTo(this.model, "change:" + this.options.valueAttribute, this.updateValueInField);
            },

            render: function () {
                this.$el.html(this.template({
                    id: this.options.valueAttribute,
                    mode: this.mode,
                    title: this.options.title,
                    iconName: this.options.iconName,
                    required: this.options.required,
                    selectOptions: this.options.options,
                    message: this.helpMessage
                }));

                this.updateValueInField();

                if (this.editable === 'toggle') {
                    this.showCanEditMessage(this.mode === 'display');
                }
                return this;
            },

            modelValueIsSet: function() {
                var value = this.modelValue();
                if (_.isUndefined(value) || _.isNull(value) || value == '') {
                    return false;
                } else {
                    return !(_.isUndefined(this.optionForValue(value)))
                }
            },

            optionForValue: function(value) {
                return _.find(this.options.options, function(option) { return option[0] == value; })
            },

            fieldValue: function () {
                return this.$('.u-field-value select').val();
            },

            displayValue: function (value) {
                if (value) {
                    var option = this.optionForValue(value);
                    return (option ? option[1] : '');
                } else {
                    return '';
                }
            },

            updateValueInField: function () {
                if (this.mode === 'display') {
                    var value = this.displayValue(this.modelValue() || '');
                    if (this.modelValueIsSet() === false) {
                        value = this.options.placeholderValue || '';
                    }
                    this.$('.u-field-value').html(Mustache.escapeHtml(value));
                    this.showDisplayMode(false);
                } else {
                    this.$('.u-field-value select').val(this.modelValue() || '');
                }
            },

            saveValue: function () {
                var attributes = {};
                attributes[this.options.valueAttribute] = this.fieldValue();
                this.saveAttributes(attributes);
            },

            showEditMode: function(render) {
                this._super(render);
                if (this.editable === 'toggle') {
                    this.$('.u-field-value select').focus();
                }
            },

            saveSucceeded: function() {
                this._super();
                if (this.editable === 'toggle') {
                    this.showDisplayMode(true);
                }
            },

            disableField: function(disable) {
                this.$('.u-field-value select').prop('disabled', disable);
            }
        });

        FieldViews.TextareaFieldView = FieldViews.EditableFieldView.extend({

            fieldType: 'textarea',

            templateSelector: '#field_textarea-tpl',

            events: {
                'click .wrapper-u-field': 'startEditing',
                'click .u-field-placeholder': 'startEditing',
                'focusout textarea': 'finishEditing',
                'change textarea': 'adjustTextareaHeight',
                'keyup textarea': 'adjustTextareaHeight',
                'keydown textarea': 'adjustTextareaHeight',
                'paste textarea': 'adjustTextareaHeight',
                'cut textarea': 'adjustTextareaHeight'
            },

            initialize: function (options) {
                _.bindAll(this, 'render', 'adjustTextareaHeight', 'fieldValue', 'saveValue', 'updateView');
                this._super(options);
                this.listenTo(this.model, "change:" + this.options.valueAttribute, this.updateView);
            },

            render: function () {
                var value = this.modelValue();
                if (this.mode === 'display') {
                    value = value || this.options.placeholderValue;
                }
                this.$el.html(this.template({
                    id: this.options.valueAttribute,
                    mode: this.mode,
                    value: value,
                    message: this.helpMessage
                }));

                this.title((this.modelValue() || this.mode === 'edit') ? this.options.title : this.indicators['plus'] + this.options.title);

                if (this.editable === 'toggle') {
                    this.showCanEditMessage(this.mode === 'display');
                }
                return this;
            },

            adjustTextareaHeight: function(event) {
                var textarea = this.$('textarea');
                textarea.css('height', 'auto').css('height', textarea.prop('scrollHeight') + 10);
            },

            modelValue: function() {
                var value = this._super();
                return  value ? $.trim(value) : '';
            },

            fieldValue: function () {
                return this.$('.u-field-value textarea').val();
            },

            saveValue: function () {
                var attributes = {};
                attributes[this.options.valueAttribute] = this.fieldValue();
                this.saveAttributes(attributes);
            },

            updateView: function () {
                if (this.mode !== 'edit') {
                    this.showDisplayMode(true);
                }
            },

            modelValueIsSet: function() {
                return !(this.modelValue() === '');
            },

            showEditMode: function(render) {
                this._super(render);
                this.adjustTextareaHeight();
                this.$('.u-field-value textarea').focus();
            },

            saveSucceeded: function() {
                this._super();
                if (this.editable === 'toggle') {
                    this.showDisplayMode(true);
                }
            }
        });

        FieldViews.LinkFieldView = FieldViews.FieldView.extend({

            fieldType: 'link',

            templateSelector: '#field_link-tpl',

            events: {
                'click a': 'linkClicked'
            },

            initialize: function (options) {
                this._super(options);
                _.bindAll(this, 'render', 'linkClicked');
            },

            render: function () {
                this.$el.html(this.template({
                    id: this.options.valueAttribute,
                    title: this.options.title,
                    linkTitle: this.options.linkTitle,
                    linkHref: this.options.linkHref,
                    message: this.helpMessage
                }));
                return this;
            },

            linkClicked: function () {
                event.preventDefault();
            }
        });

        FieldViews.ImageFieldView = FieldViews.FieldView.extend({

            fieldType: 'image',

            templateSelector: '#field_image-tpl',
            uploadButtonSelector: '.upload-button-input',

            titleAdd: gettext("Upload an image"),
            titleEdit: gettext("Change image"),
            titleRemove: gettext("Remove"),

            titleUploading: gettext("Uploading"),
            titleRemoving: gettext("Removing"),

            titleImageAlt: '',

            iconUpload: '<i class="icon fa fa-camera" aria-hidden="true"></i>',
            iconRemove: '<i class="icon fa fa-remove" aria-hidden="true"></i>',
            iconProgress: '<i class="icon fa fa-spinner fa-pulse fa-spin" aria-hidden="true"></i>',

            errorMessage: gettext("An error has occurred. Refresh the page, and then try again."),

            events: {
                'click .u-field-upload-button': 'clickedUploadButton',
                'click .u-field-remove-button': 'clickedRemoveButton'
            },

            initialize: function (options) {
                this._super(options);
                _.bindAll(this, 'render', 'imageChangeSucceeded', 'imageChangeFailed', 'fileSelected',
                          'watchForPageUnload', 'onBeforeUnload');
                this.listenTo(this.model, "change:" + this.options.valueAttribute, this.render);
            },

            render: function () {
                this.$el.html(this.template({
                    id: this.options.valueAttribute,
                    imageUrl: _.result(this, 'imageUrl'),
                    imageAltText: _.result(this, 'imageAltText'),
                    uploadButtonIcon: _.result(this, 'iconUpload'),
                    uploadButtonTitle: _.result(this, 'uploadButtonTitle'),
                    removeButtonIcon: _.result(this, 'iconRemove'),
                    removeButtonTitle: _.result(this, 'removeButtonTitle')
                }));
                this.updateButtonsVisibility();
                this.watchForPageUnload();
                return this;
            },

            showErrorMessage: function () {
            },

            imageUrl: function () {
                return '';
            },

            uploadButtonTitle: function () {
                if (this.isShowingPlaceholder()) {
                    return _.result(this, 'titleAdd')
                } else {
                    return _.result(this, 'titleEdit')
                }
            },

            removeButtonTitle: function () {
                return this.titleRemove;
            },

            isEditingAllowed: function () {
                return true
            },

            isShowingPlaceholder: function () {
                return false;
            },

            setUploadButtonVisibility: function (state) {
                this.$('.u-field-upload-button').css('display', state);
            },

            setRemoveButtonVisibility: function (state) {
                this.$('.u-field-remove-button').css('display', state);
            },

            updateButtonsVisibility: function () {
                if (!this.isEditingAllowed() || !this.options.editable) {
                    this.setUploadButtonVisibility('none');
                }

                if (this.isShowingPlaceholder() || !this.options.editable) {
                    this.setRemoveButtonVisibility('none');
                }
            },

            clickedUploadButton: function () {
                $(this.uploadButtonSelector).fileupload({
                    url: this.options.imageUploadUrl,
                    type: 'POST',
                    add: this.fileSelected,
                    done: this.imageChangeSucceeded,
                    fail: this.imageChangeFailed
                });
            },

            clickedRemoveButton: function () {
                var view = this;
                this.setCurrentStatus('removing');
                this.setUploadButtonVisibility('none');
                this.showRemovalInProgressMessage();
                 $.ajax({
                    type: 'POST',
                    url: this.options.imageRemoveUrl,
                    success: function (data, status, xhr) {
                        view.imageChangeSucceeded();
                    },
                    error: function (xhr, status, error) {
                       view.imageChangeFailed();
                    }
                });
            },

            imageChangeSucceeded: function (e, data) {
                this.render();
            },

            imageChangeFailed: function (e, data) {
            },

            fileSelected: function (e, data) {
                if (this.validateImageSize(data.files[0].size)) {
                    data.formData = {file: data.files[0]};
                    this.setCurrentStatus('uploading');
                    this.setRemoveButtonVisibility('none');
                    this.showUploadInProgressMessage();
                    data.submit();
                }
            },

            validateImageSize: function (imageBytes) {
                var humanReadableSize;
                if (imageBytes < this.options.imageMinBytes) {
                    humanReadableSize = this.bytesToHumanReadable(this.options.imageMinBytes);
                    this.showErrorMessage(interpolate_text(gettext("Your image must be at least {size} in size."), {size: humanReadableSize}));
                    return false;
                } else if (imageBytes > this.options.imageMaxBytes) {
                    humanReadableSize = this.bytesToHumanReadable(this.options.imageMaxBytes);
                    this.showErrorMessage(interpolate_text(gettext("Your image must be smaller than {size} in size."), {size: humanReadableSize}));
                    return false;
                }
                return true;
            },

            showUploadInProgressMessage: function () {
                this.$('.u-field-upload-button').css('opacity', 1);
                this.$('.upload-button-icon').html(this.iconProgress);
                this.$('.upload-button-title').html(this.titleUploading);
            },

            showRemovalInProgressMessage: function () {
                this.$('.u-field-remove-button').css('opacity', 1);
                this.$('.remove-button-icon').html(this.iconProgress);
                this.$('.remove-button-title').html(this.titleRemoving);
            },

            setCurrentStatus: function (status) {
                this.$('.image-wrapper').attr('data-status', status);
            },

            getCurrentStatus: function () {
                return this.$('.image-wrapper').attr('data-status');
            },

            inProgress: function() {
                var status = this.getCurrentStatus();
                return _.isUndefined(status) ? false : true;
            },

            watchForPageUnload: function () {
                $(window).on('beforeunload', this.onBeforeUnload);
            },

            onBeforeUnload: function () {
                var status = this.getCurrentStatus();
                if (status === 'uploading') {
                    return gettext("Upload is in progress. To avoid errors, stay on this page until the process is complete.");
                } else if (status === 'removing') {
                    return gettext("Removal is in progress. To avoid errors, stay on this page until the process is complete.");
                }
            },

            bytesToHumanReadable: function (size) {
                var units = ['Bytes', 'KB', 'MB'];
                var i = 0;
                while(size >= 1024) {
                    size /= 1024;
                    ++i;
                }
                return size.toFixed(1)*1 + ' ' + units[i];
            }
        });

        return FieldViews;
    })
}).call(this, define || RequireJS.define);
