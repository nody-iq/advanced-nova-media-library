<template>
  <div
    class="gallery"
    :class="{ editable }"
    @mouseover="mouseOver = true"
    @mouseout="mouseOver = false"
  >
    <div v-if="field.type === 'media' && editable">
      <Modal
        :show="cropImageQueue.length > 0"
        @modal-close="onCancel"
        class="modal-cropper"
      >
        <card
          class="text-center clipping-container max-w-view bg-white rounded-lg shadow-lg overflow-hidden"
        >
          <div class="p-4">
            <div
              v-if="!imagesLoaded"
              class="text-center text-xl text-gray-500 py-2"
            >
              {{ __("Loading Media...") }}
            </div>
            <Cropper
              v-if="toCropImage"
              ref="clipper"
              :src="toCropImage.imageUrl"
              :stencil-props="field.croppingConfigs || {}"
              :default-size="defaultSize"
            />
          </div>

          <div class="bg-30 px-6 py-3 footer rounded-lg">
            <OutlineButton v-if="!cropAnyway" type="button" @click="onCancel">{{
              __("Cancel")
            }}</OutlineButton>

            <DefaultButton
              type="button"
              class="btn btn-default btn-primary"
              @click="onSave"
              ref="updateButton"
              >{{ __("Update") }}
            </DefaultButton>
          </div>
        </card>
      </Modal>
    </div>

    <!-- Draggable component for reordering images -->
    <draggable
      v-if="images.length > 0"
      v-model="images"
      class="gallery-list clearfix w-full flex flex-wrap justify-center gap-2"
    >
      <template #item="{ element, index }">
        <div>
          <!-- Dynamic component for handling single media or file based on field type -->
          <component
            :is="singleComponent"
            class="p-1"
            :key="index"
            :image="element"
            :field="field"
            :editable="editable"
            :removable="removable || editable"
            @remove="remove(index)"
            :is-custom-properties-editable="
              customProperties && customPropertiesFields.length > 0
            "
            @edit-custom-properties="customPropertiesImageIndex = index"
            @crop-start="cropStart(element)"
          />

          <!-- Custom properties component for editing image properties -->
          <CustomProperties
            v-if="customPropertiesImageIndex !== null"
            v-model="images[customPropertiesImageIndex]"
            :fields="customPropertiesFields"
            @close="customPropertiesImageIndex = null"
          />
        </div>
      </template>
    </draggable>

    <!-- Placeholder text when there are no images and gallery is not editable -->
    <span v-else-if="!editable" class="mr-3">&mdash;</span>

    <!-- File input for uploading new images -->
    <span v-if="editable" class="flex justify-center mt-2">
      <input
        :id="`__media__${field.attribute}`"
        :multiple="multiple"
        ref="file"
        type="file"
        class="form-file-input"
        :disabled="uploading"
        @change="add"
      />
      <label :for="`__media__${field.attribute}`">
        <DefaultButton type="button" @click.prevent="focusFileInput()">
          <template v-if="uploading">
            {{ __("Uploading") }} ({{ uploadProgress }}%)
          </template>
          <template v-else>{{ label }}</template>
        </DefaultButton>
      </label>
    </span>

    <!-- Help text component for non-media fields -->
    <help-text
      v-if="field.type !== 'media'"
      :show-span="showHelpText"
      class="mt-2"
    >
      {{ field.helpText }}
    </help-text>

    <!-- Error message display -->
    <p v-if="hasError" class="my-2 text-danger">
      {{ firstError }}
    </p>
  </div>
</template>

<script>
import SingleMedia from "./SingleMedia";
import SingleFile from "./SingleFile";
import Converter from "../converter";
import { Cropper } from "vue-advanced-cropper";
import "vue-advanced-cropper/dist/style.css";
import CustomProperties from "./CustomProperties";
import Draggable from "vuedraggable";
import lodash from "lodash";

export default {
  components: {
    Draggable,
    SingleMedia,
    SingleFile,
    CustomProperties,
    Cropper,
  },

  props: {
    hasError: Boolean,
    firstError: String,
    field: Object,
    modelValue: Array,
    editable: Boolean,
    removable: Boolean,
    multiple: Boolean,
    customProperties: {
      type: Boolean,
      default: false,
    },
  },

  data() {
    return {
      toCropImage: null,
      imagesLoaded: true,
      cropImageQueue: [],
      images: this.modelValue || [],
      customPropertiesImageIndex: null,
      singleComponent: this.field.type === "media" ? SingleMedia : SingleFile,
      uploading: false,
      uploadProgress: 0,
    };
  },

  methods: {
    async add() {
      this.imagesLoaded = false;
      const files = this.$refs.file.files;
      if (files.length > 0) {
        for (const file of files) {
          const blobFile = new Blob([file], { type: file.type });
          blobFile.lastModifiedDate = new Date();
          blobFile.name = file.name;
          await this.readFile(blobFile);
        }

        this.$nextTick(() => {
          this.toCropImage = lodash.last(this.cropImageQueue);
          this.$refs.clipper?.reset();
          this.imagesLoaded = true;
          this.$refs.file.value = "";
        });
      }
    },

    async readFile(file) {
      return new Promise((resolve, reject) => {
        let reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
          const fileData = {
            file: file,
            __media_urls__: {
              __original__: reader.result,
              default: reader.result,
            },
            name: file.name,
            file_name: file.name,
            imageUrl: reader.result,
            ...(this.mustCrop && { mustCrop: true }),
          };

          if (!this.validateFile(fileData.file)) {
            reject("File validation failed");
            return;
          }

          resolve(fileData);
        };
      }).then((fileData) => {
        if (this.mustCrop) this.cropImageQueue.push(fileData);
        this.images.push(fileData);
      });
    },

    onSave() {
      const { canvas } = this.$refs.clipper.getResult();
      const base64 = canvas.toDataURL(this.mime);
      const file = Converter(base64, this.mime, this.toCropImage.file_name);
      let fileData = {
        file,
        __media_urls__: { __original__: base64, default: base64 },
        name: file.name,
        file_name: file.name,
      };

      const index = this.images.findIndex(
        (img) => img.file === this.toCropImage.file
      );
      this.images.splice(index, 1, {
        ...fileData,
        custom_properties: { ...this.toCropImage.custom_properties },
      });

      this.cropImageQueue.pop();
      this.toCropImage = lodash.last(this.cropImageQueue);
      this.$refs.clipper.reset();
      this.$emit("update:modelValue", this.images);
    },

    cropStart(element) {
      this.cropImageQueue.push(element);
      this.toCropImage = {
        ...element,
        mustCrop: true,
        imageUrl: element.original_url,
      };
    },

    onCancel() {
      if (this.cropAnyway) {
        this.onSave();
      } else {
        this.cropImageQueue.pop();
      }
    },

    retrieveImageFromClipboardAsBlob(pasteEvent, callback) {
      if (pasteEvent.clipboardData == false) {
        if (typeof callback == "function") {
          callback(undefined);
        }
      }
      var items = pasteEvent.clipboardData.items;
      if (items == undefined) {
        if (typeof callback == "function") {
          callback(undefined);
        }
      }
      for (var i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") == -1) continue;
        var blob = items[i].getAsFile();

        if (typeof callback == "function") {
          callback(blob);
        }
      }
    },

    focusFileInput() {
      this.$refs.file.click();
    },

    remove(index) {
      this.images.splice(index, 1);
    },

    validateFile(file) {
      return this.validateFileSize(file) && this.validateFileType(file);
    },

    validateFileSize(file) {
      if (this.field.maxFileSize && file.size / 1024 > this.field.maxFileSize) {
        this.$toasted.error(
          this.__("Maximum file size is :amount MB", {
            amount: String(this.field.maxFileSize / 1024),
          })
        );
        return false;
      }
      return true;
    },

    validateFileType(file) {
      if (!Array.isArray(this.field.allowedFileTypes)) {
        return true;
      }

      for (const type of this.field.allowedFileTypes) {
        if (file.type.startsWith(type)) {
          return true;
        }
      }

      this.$toasted.error(
        this.__("File type must be: :types", {
          types: this.field.allowedFileTypes.join(" / "),
        })
      );
      return false;
    },

    defaultSize({ imageSize, visibleArea }) {
      return {
        width: (visibleArea || imageSize).width,
        height: (visibleArea || imageSize).height,
      };
    },
  },

  computed: {
    cropAnyway() {
      return this.toCropImage
        ? this.toCropImage.mustCrop === true && this.mustCrop
        : false;
    },

    mime() {
      return this.toCropImage
        ? this.toCropImage.mime_type || this.toCropImage.file.type
        : null;
    },

    mustCrop() {
      return "mustCrop" in this.field && this.field.mustCrop;
    },

    customPropertiesFields() {
      return this.field.customPropertiesFields || [];
    },

    draggable() {
      return this.editable && this.multiple;
    },

    label() {
      const type = this.field.type === "media" ? "Media" : "File";
      return this.multiple || this.images.length === 0
        ? this.__(`Add New ${type}`)
        : this.__(`Upload New ${type}`);
    },
  },

  watch: {
    modelValue(value) {
      this.images = value || [];
    },

    images(value, old) {
      this.$emit("update:modelValue", this.images);
    },
  },

  mounted: function () {
    // Using $nextTick to ensure the DOM is updated before adding event listeners
    this.$nextTick(() => {
      // Adding a 'paste' event listener to the window object
      window.addEventListener(
        "paste",
        (e) => {
          // Check if the mouse is over the component, if not, ignore the paste event
          if (!this.mouseOver) {
            return;
          }
          // Retrieve image from clipboard as a blob
          this.retrieveImageFromClipboardAsBlob(e, (imageBlob) => {
            // If an image blob is found, read it as a file
            if (imageBlob) {
              this.readFile(imageBlob);
            }
          });
        },
        false // Use capture mode for the event listener
      );
    });
  },
};
</script>

<style lang="scss" scoped>
.gallery {
  &.editable {
    .gallery-item {
      cursor: pointer; /* Changed from 'grab' to 'pointer' for better user indication */
      &:hover {
        opacity: 0.8; /* Added hover effect for better user interaction */
      }
    }
  }
}

.footer {
  display: flex;
  justify-content: space-between;
  padding: 10px 20px; /* Added padding for better spacing */
  border-top: 1px solid #ccc; /* Added border for visual separation */
}

.modal-cropper {
  z-index: 1000; /* Increased z-index for higher stacking context */
}

.max-w-view {
  max-width: calc(100vw - 6.5rem);
  overflow: hidden; /* Added to prevent overflow issues */
}

@media (min-aspect-ratio: 4/3) {
  .max-w-view {
    max-width: 60vw;
    padding: 20px; /* Added padding for better content spacing */
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s ease-in-out; /* Enhanced transition for smoother visual effect */
}
.fade-enter,
.fade-leave-to {
  opacity: 0;
  transition-delay: 0.1s; /* Added delay for better transition timing */
}
</style>
