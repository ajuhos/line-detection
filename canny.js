function applyCanny(imageData, blur_radius = 2, low_threshold = 20, high_threshold = 50) {
    const w = imageData.width,
        h = imageData.height;

    const img_u8 = new jsfeat.matrix_t(w, h, jsfeat.U8C1_t);
    jsfeat.imgproc.grayscale(imageData.data, w, h, img_u8);

    //const kernel_size = (blur_radius+1) << 1;
    //jsfeat.imgproc.gaussian_blur(img_u8, img_u8, kernel_size, 0);
    jsfeat.imgproc.canny(img_u8, img_u8, low_threshold, high_threshold);

    const data_u32 = new Uint32Array(imageData.data.buffer);
    const alpha = (0xff << 24);
    let i = img_u8.cols*img_u8.rows, pix = 0;
    while(--i >= 0) {
        pix = img_u8.data[i];
        data_u32[i] = alpha | (pix << 16) | (pix << 8) | pix;
    }
    return imageData;
}