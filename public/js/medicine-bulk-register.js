document.addEventListener('DOMContentLoaded', () => {
    bindAutocompleteMedicineName();
    bindAutocompleteHospital();

    addMedicine([]);
});

function bindAutocompleteMedicineName() {
    $('.autocomplete-medicine-name').autocomplete({
        source: (request, response) => {
            $.getJSON('/data/medicine.json', (data) => {
                let array = $.map(data, (value) => {
                    return value.data;
                });
                let result = $.ui.autocomplete.filter(array, request.term);
                response(result.slice(0, 30));
            });
        }
    });
}

function bindAutocompleteHospital() {
    $('.autocomplete-hospital').autocomplete({
        source: (request, response) => {
            $.getJSON('/data/hospital.json', (data) => {
                let array = $.map(data, (value) => {
                    return value.data;
                });
                let result = $.ui.autocomplete.filter(array, request.term);
                response(result.slice(0, 30));
            });
        }
    });
}

function ocrImagePicker() {
    const notyf = new Notyf({
        position: {
            y: 'top',
        },
    });

    let file = document.createElement('input');
    file.type = 'file';
    file.accept = 'image/jpeg,image/png';
    file.click();
    file.onchange = async function () {
        swal('解析中です…', {
            buttons: false,
            closeOnEsc: false,
            closeOnClickOutside: false
        });
        let obj = $(file).prop('files')[0];
        if (obj === undefined) {
            return;
        }
        let formData = new FormData();
        formData.append('image', obj);
        $.ajax({
            url: '/api/ocr',
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false
        }).done(function (response) {
            if (Object.keys(response).length === 0) {
                notyf.error('文字を検出できませんでした');
            } else {
                notyf.success('文字を検出しました');

                $('div[data-medicine-item-id="1"]').remove();

                for (let i = 0; i < response['result'][0]['medicineName'].length; i++) {
                    let medicineName = response['result'][0]['medicineName'][i]['result'];

                    addMedicine({
                        'medicine_name': medicineName
                    });
                }
            }
        }).fail(function () {
            notyf.error('解析に失敗しました');
        }).always(function () {
            swal.close();
        });
    }
}

function addMedicine(values) {
    let source = $('#template_medicine_item').html();
    let template = Handlebars.compile(source);
    let html = template(values);
    let body = $('#medicine-list')[0];
    body.insertAdjacentHTML('beforeend', html);

    $('.select2').select2();
    bindAutocompleteMedicineName();
    setMedicineItemId();
}

function deleteMedicine(button) {
    let target = $(button).parents('div[data-type=medicine-item]');
    target.remove();
    setMedicineItemId();
}

async function postMedicine(button) {
    const notyf = new Notyf({
        position: {
            y: 'top',
        },
    });

    // dom find
    let basicDom = $('div[data-type=medicine-basic]');
    let itemDom = $('div[data-type=medicine-item]');
    if (basicDom.length !== 1 || itemDom.length === 0) {
        notyf.error('登録する項目が見つかりませんでした');
        return false;
    }
    basicDom = basicDom[0];

    // basic value
    let hospitalName = $(basicDom).find('input[name=hospital_name]').val();
    let startsDate = $(basicDom).find('input[name=starts_date]').val();
    let groupId = $(basicDom).find('select[name=group_id]').val();

    let data = {
        'hospital_name': hospitalName,
        'starts_date': startsDate,
        'group_id': groupId,
        'item': []
    };

    // item value
    for (let i = 0; i < itemDom.length; i++) {
        let itemId = $(itemDom[i]).attr('data-medicine-item-id');
        let medicineName = $(itemDom[i]).find('input[name=medicine_name]').val();
        let takeTime = $(itemDom[i]).find('select[name=take_time]').val();
        let number = $(itemDom[i]).find('input[name=number]').val();
        let period = $(itemDom[i]).find('input[name=period]').val();
        let medicineType = $(itemDom[i]).find('select[name=medicine_type]').val();

        data['item'][itemId] = {
            'medicine_name': medicineName,
            'take_time': takeTime,
            'number': number,
            'period': period,
            'medicine_type': medicineType
        };
    }

    if(!$(button).hasClass('clicked') || !$(button).hasClass('btn-progress')) {
        $(button).addClass('disabled');
        $(button).addClass('btn-progress');
    }

    // btn-progress debug
    // await new Promise(resolve => setTimeout(resolve, 3000))

    $(`div[data-item-name] > span.form-error`).text('');

    $.ajax({
        type: 'post',
        url: '/bulk-register',
        data:JSON.stringify(data),
        contentType: 'application/json',
        dataType: 'json'
    }).done(function (json) {
        if (json['status'] === false) {
            notyf.error(json['message']);
            let error = json['error'];

            if (error['hospital_name'] !== undefined) {
                $(basicDom).find('div[data-item-name="hospital-name"] > span.form-error').text(error['hospital_name']);
            }
            if (error['starts_date'] !== undefined) {
                $(basicDom).find('div[data-item-name="starts-date"] > span.form-error').text(error['starts_date']);
            }
            if (error['group_id'] !== undefined) {
                $(basicDom).find('div[data-item-name="group-id"] > span.form-error').text(error['group_id']);
            }

            let item = error['item'];
            for (let i = 1; i < item.length; i++) {
                if (item[i]['medicine_name'] !== undefined) {
                    $(`div[data-medicine-item-id="${i}"]`).find('div[data-item-name="medicine-name"] > span.form-error').text(item[i]['medicine_name']);
                }
                if (item[i]['number'] !== undefined) {
                    $(`div[data-medicine-item-id="${i}"]`).find('div[data-item-name="number"] > span.form-error').text(item[i]['number']);
                }
                if (item[i]['period'] !== undefined) {
                    $(`div[data-medicine-item-id="${i}"]`).find('div[data-item-name="period"] > span.form-error').text(item[i]['period']);
                }
                if (item[i]['take_time'] !== undefined) {
                    $(`div[data-medicine-item-id="${i}"]`).find('div[data-item-name="take-time"] > span.form-error').text(item[i]['take_time']);
                }
                if (item[i]['medicine_type'] !== undefined) {
                    $(`div[data-medicine-item-id="${i}"]`).find('div[data-item-name="medicine-type"] > span.form-error').text(item[i]['medicine_type']);
                }
            }
        } else {
            location.href = '/';
        }
    }).fail(function () {
        notyf.error('送信に失敗しました');
    }).always(function () {
        $(button).removeClass('disabled');
        $(button).removeClass('btn-progress');
    });
}

function setMedicineItemId() {
    let itemDom = $('div[data-type="medicine-item"]');
    if (itemDom.length === 0) {
        return false;
    }
    for (let i = 0; i < itemDom.length; i++) {
        $(itemDom[i]).attr('data-medicine-item-id', i + 1);
    }
}